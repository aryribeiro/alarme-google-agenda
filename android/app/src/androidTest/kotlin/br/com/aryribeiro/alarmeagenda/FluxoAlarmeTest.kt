package br.com.aryribeiro.alarmeagenda

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.os.PowerManager
import android.provider.CalendarContract
import android.provider.CalendarContract.Calendars
import android.provider.CalendarContract.Events
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.TimeZone
import kotlin.math.abs

/**
 * Prova no aparelho (emulador do CI) o que só o Android real mostra: leitura da agenda,
 * agendamento no relógio de alarmes e o toque na hora, inclusive com a tela apagada e em Doze.
 */
@RunWith(AndroidJUnit4::class)
class FluxoAlarmeTest {
    @get:Rule
    val permissoes: GrantPermissionRule = GrantPermissionRule.grant(
        Manifest.permission.READ_CALENDAR,
        Manifest.permission.WRITE_CALENDAR,
        Manifest.permission.POST_NOTIFICATIONS,
    )

    private val instr = InstrumentationRegistry.getInstrumentation()
    private val c: Context = instr.targetContext
    private val min = 60_000L
    private var agendaId = -1L

    private val uriSync: Uri = Calendars.CONTENT_URI.buildUpon()
        .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
        .appendQueryParameter(Calendars.ACCOUNT_NAME, CONTA)
        .appendQueryParameter(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
        .build()

    @Before
    fun preparar() {
        shell("dumpsys deviceidle unforce")
        shell("dumpsys deviceidle disable")
        shell("dumpsys battery reset")
        shell("input keyevent KEYCODE_WAKEUP")
        Prefs.limparTudo(c)
        limparAgenda()
        agendaId = ContentUris.parseId(
            c.contentResolver.insert(uriSync, ContentValues().apply {
                put(Calendars.ACCOUNT_NAME, CONTA)
                put(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
                put(Calendars.NAME, "Teste")
                put(Calendars.CALENDAR_DISPLAY_NAME, "Agenda de teste")
                put(Calendars.CALENDAR_ACCESS_LEVEL, Calendars.CAL_ACCESS_OWNER)
                put(Calendars.OWNER_ACCOUNT, CONTA)
                put(Calendars.VISIBLE, 1)
                put(Calendars.SYNC_EVENTS, 1)
                put(Calendars.CALENDAR_TIME_ZONE, TimeZone.getDefault().id)
            })!!
        )
    }

    @After
    fun limpar() {
        // Só há o que parar se algo estiver tocando (e fora disso o Android nem deixa iniciar o serviço)
        if (RingService.tocando != null) {
            runCatching { c.startService(RingService.intent(c, RingService.ACAO_PARAR, Reuniao(-1, 0, "", null), Tipo.AGORA)) }
            esperar(5_000) { RingService.tocando == null }
        }
        shell("dumpsys deviceidle unforce")
        shell("dumpsys deviceidle disable")
        shell("dumpsys battery reset")
        shell("svc power stayon true")
        shell("input keyevent KEYCODE_WAKEUP")
        limparAgenda()
        Prefs.limparTudo(c)
        AlarmScheduler.sincronizar(c)
    }

    @Test
    fun le_da_agenda_do_aparelho_so_o_que_merece_alarme() {
        val agora = System.currentTimeMillis()
        val comMeet = criarReuniao("Daily", agora + 30 * min, descricao = "Participar com o Google Meet: https://meet.google.com/abc-defg-hij")
        criarReuniao("Feriado", agora + 60 * min, diaInteiro = true)
        criarReuniao("Cancelada", agora + 40 * min, status = Events.STATUS_CANCELED)

        val reunioes = CalendarReader.reunioes(c, agora)

        assertEquals(listOf("Daily"), reunioes.map { it.titulo })
        assertEquals(comMeet, reunioes[0].eventId)
        assertEquals("https://meet.google.com/abc-defg-hij", reunioes[0].link)
        assertTrue("a agenda local de teste deve contar como principal", agendaId.toString() in CalendarReader.agendasAtivas(c))
    }

    @Test
    fun agenda_o_proximo_toque_no_relogio_de_alarmes_do_android() {
        val agora = System.currentTimeMillis()
        val inicio = agora + 30 * min
        criarReuniao("Review", inicio)

        val ponto = AlarmScheduler.sincronizar(c, agora)

        assertEquals(Tipo.ANTES, ponto?.tipo)
        val relogio = c.getSystemService(AlarmManager::class.java).nextAlarmClock
        assertNotNull("o Android deve mostrar um alarme agendado", relogio)
        assertTrue("deve tocar 5 minutos antes do início", abs(relogio!!.triggerTime - (inicio - 5 * min)) < 1_000)
    }

    @Test
    fun reuniao_apagada_da_agenda_tira_o_alarme() {
        val agora = System.currentTimeMillis()
        val id = criarReuniao("Some", agora + 30 * min)
        assertNotNull(AlarmScheduler.sincronizar(c, agora))

        c.contentResolver.delete(ContentUris.withAppendedId(Events.CONTENT_URI, id), null, null)

        assertNull(AlarmScheduler.sincronizar(c))
        assertNull(c.getSystemService(AlarmManager::class.java).nextAlarmClock)
    }

    @Test
    fun toca_de_verdade_e_para_quando_mandam_parar() {
        // Começa em 2 min: já está dentro da janela de 5 min, então toca na hora
        val inicio = System.currentTimeMillis() + 2 * min
        val id = criarReuniao("Em cima da hora", inicio)

        AlarmScheduler.sincronizar(c)

        assertTrue("o alarme deve começar a tocar", esperar(20_000) { RingService.tocando == "$id|$inicio" })
        val avisos = c.getSystemService(NotificationManager::class.java).activeNotifications.map { it.id }
        assertTrue("o aviso do alarme deve estar na tela", RingService.ID_TOCANDO in avisos)

        c.startService(RingService.intent(c, RingService.ACAO_PARAR, Reuniao(id, inicio, "Em cima da hora", null), Tipo.ANTES))

        assertTrue("deve parar de tocar", esperar(5_000) { RingService.tocando == null })
        // Parar silencia só este toque: o do início da reunião continua agendado
        val relogio = c.getSystemService(AlarmManager::class.java).nextAlarmClock
        assertNotNull(relogio)
        assertTrue(abs(relogio!!.triggerTime - inicio) < 1_000)
    }

    @Test
    fun dispensar_cancela_os_toques_seguintes_da_reuniao() {
        val inicio = System.currentTimeMillis() + 2 * min
        val id = criarReuniao("Vou entrar", inicio)
        AlarmScheduler.sincronizar(c)
        assertTrue(esperar(20_000) { RingService.tocando != null })

        c.startService(RingService.intent(c, RingService.ACAO_DISPENSAR, Reuniao(id, inicio, "Vou entrar", null), Tipo.ANTES))

        assertTrue(esperar(5_000) { RingService.tocando == null })
        assertNull("sem mais toques para a reunião dispensada", c.getSystemService(AlarmManager::class.java).nextAlarmClock)
    }

    @Test
    fun soneca_toca_de_novo_em_dois_minutos() {
        // Começa em 4 min: toca já (janela de 5 min) e a soneca de 2 min cai antes do início
        val inicio = System.currentTimeMillis() + 4 * min
        val reuniao = Reuniao(criarReuniao("Depois", inicio), inicio, "Depois", null)
        AlarmScheduler.sincronizar(c)
        assertTrue(esperar(20_000) { RingService.tocando != null })
        val antes = System.currentTimeMillis()

        c.startService(RingService.intent(c, RingService.ACAO_SONECA, reuniao, Tipo.AGORA))

        assertTrue(esperar(5_000) { RingService.tocando == null })
        val relogio = c.getSystemService(AlarmManager::class.java).nextAlarmClock
        assertNotNull(relogio)
        assertTrue("a soneca vem antes do aviso da reunião", abs(relogio!!.triggerTime - (antes + RingService.SONECA_MS)) < 5_000)
    }

    @Test
    fun toca_na_hora_mesmo_com_o_aparelho_ja_em_doze_e_a_tela_apagada() {
        // Sem nenhum alarme agendado o Android deixa entrar em Doze profundo
        assertNull(AlarmScheduler.sincronizar(c))
        entrarEmDoze()

        // A reunião aparece com o aparelho já dormindo; o aviso de antecedência cai daqui a ~25 s
        val inicio = System.currentTimeMillis() + 5 * min + 25_000
        val id = criarReuniao("Tela apagada", inicio)
        assertNotNull(AlarmScheduler.sincronizar(c))

        assertTrue(
            "o alarme deve tocar com o aparelho em Doze e a tela apagada",
            esperar(60_000) { RingService.tocando == "$id|$inicio" },
        )
        val atraso = System.currentTimeMillis() - (inicio - 5 * min)
        assertTrue("tocou com atraso de $atraso ms", atraso < 15_000)
    }

    @Test
    fun alarme_agendado_impede_o_aparelho_de_cair_no_sono_profundo() {
        criarReuniao("Logo mais", System.currentTimeMillis() + 15 * min)
        assertNotNull(AlarmScheduler.sincronizar(c))

        apagarTela()
        shell("dumpsys deviceidle enable deep")
        val resposta = shell("dumpsys deviceidle force-idle deep")

        // É a garantia do relógio de alarmes: com despertador próximo, o Android não entra em Doze profundo
        assertTrue(
            "o Android não deveria entrar em Doze com alarme próximo (resposta: ${resposta.trim()})",
            shell("dumpsys deviceidle get deep").trim() != "IDLE",
        )
    }

    private fun apagarTela() {
        val energia = c.getSystemService(PowerManager::class.java)
        shell("dumpsys battery unplug")
        // O emulador do CI fica "sempre acordado": sem desligar isso a tela não apaga
        shell("svc power stayon false")
        shell("input keyevent KEYCODE_SLEEP")
        assertTrue("a tela deve apagar", esperar(10_000) { !energia.isInteractive })
    }

    private fun entrarEmDoze() {
        apagarTela()
        // O emulador vem com o Doze desligado: liga antes de forçar (senão o teste não prova nada)
        shell("dumpsys deviceidle enable deep")
        val resposta = shell("dumpsys deviceidle force-idle deep")
        assertTrue(
            "o aparelho deve estar em Doze (resposta: ${resposta.trim()})",
            esperar(10_000) { shell("dumpsys deviceidle get deep").trim() == "IDLE" },
        )
    }

    // ---- apoio ----

    private fun criarReuniao(
        titulo: String,
        inicio: Long,
        diaInteiro: Boolean = false,
        status: Int = Events.STATUS_CONFIRMED,
        descricao: String? = null,
    ): Long {
        val valores = ContentValues().apply {
            put(Events.CALENDAR_ID, agendaId)
            put(Events.TITLE, titulo)
            put(Events.STATUS, status)
            put(Events.DESCRIPTION, descricao)
            if (diaInteiro) {
                val dia = 24 * 60 * min
                val meiaNoiteUtc = (inicio / dia) * dia
                put(Events.ALL_DAY, 1)
                put(Events.DTSTART, meiaNoiteUtc)
                put(Events.DTEND, meiaNoiteUtc + dia)
                put(Events.EVENT_TIMEZONE, "UTC")
            } else {
                put(Events.DTSTART, inicio)
                put(Events.DTEND, inicio + 30 * min)
                put(Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
            }
        }
        return ContentUris.parseId(c.contentResolver.insert(Events.CONTENT_URI, valores)!!)
    }

    private fun limparAgenda() {
        c.contentResolver.delete(uriSync, "${Calendars.ACCOUNT_NAME} = ?", arrayOf(CONTA))
    }

    private fun esperar(limiteMs: Long, condicao: () -> Boolean): Boolean {
        val fim = System.currentTimeMillis() + limiteMs
        while (System.currentTimeMillis() < fim) {
            if (condicao()) return true
            Thread.sleep(250)
        }
        return condicao()
    }

    private fun shell(comando: String): String {
        val saida = instr.uiAutomation.executeShellCommand(comando)
        return ParcelFileDescriptor.AutoCloseInputStream(saida).bufferedReader().use { it.readText() }
    }

    private companion object {
        const val CONTA = "teste-alarme@local"
    }
}
