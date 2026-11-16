package br.com.aryribeiro.alarmeagenda

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.os.PowerManager
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs

/**
 * Prova no aparelho (emulador do CI) o que só o Android real mostra: agendamento no relógio de alarmes
 * a partir da lista do servidor, o toque na hora (inclusive com a tela apagada e em Doze), o login e a tela.
 * Nenhum teste chama o servidor de produção.
 */
@RunWith(AndroidJUnit4::class)
class FluxoAlarmeTest {
    @get:Rule
    val permissoes: GrantPermissionRule = GrantPermissionRule.grant(Manifest.permission.POST_NOTIFICATIONS)

    private val instr = InstrumentationRegistry.getInstrumentation()
    private val c: Context = instr.targetContext
    private val min = 60_000L

    @Before
    fun preparar() {
        // Endereço que recusa conexão: a busca falha sem desconectar e sem tocar a produção
        Api.servidor = "https://127.0.0.1:9"
        shell("dumpsys deviceidle unforce")
        shell("dumpsys battery reset")
        shell("input keyevent KEYCODE_WAKEUP")
        Prefs.limparTudo(c)
        Prefs.conectar(c, "token-de-teste-0000000000", "verificador-de-teste")
    }

    @After
    fun limpar() {
        // Só há o que parar se algo estiver tocando (e fora disso o Android nem deixa iniciar o serviço)
        if (RingService.tocando != null) {
            runCatching { c.startService(RingService.intent(c, RingService.ACAO_PARAR, Reuniao("x", 0, "", null), Tipo.AGORA)) }
            esperar(5_000) { RingService.tocando == null }
        }
        shell("dumpsys deviceidle unforce")
        shell("dumpsys deviceidle disable")
        shell("dumpsys battery reset")
        shell("svc power stayon true")
        shell("input keyevent KEYCODE_WAKEUP")
        Prefs.limparTudo(c)
        AlarmScheduler.sincronizar(c)
    }

    @Test
    fun agenda_o_proximo_toque_a_partir_da_lista_do_servidor() {
        val agora = System.currentTimeMillis()
        val inicio = agora + 30 * min
        salvarLista(Reuniao("review", inicio, "Review", null, inicio + 30 * min))

        val ponto = AlarmScheduler.sincronizar(c, agora)

        assertEquals(Tipo.ANTES, ponto?.tipo)
        val relogio = c.getSystemService(AlarmManager::class.java).nextAlarmClock
        assertNotNull("o Android deve mostrar um alarme agendado", relogio)
        assertTrue("deve tocar 5 minutos antes do início", abs(relogio!!.triggerTime - (inicio - 5 * min)) < 1_000)
    }

    @Test
    fun reuniao_que_some_da_lista_tira_o_alarme() {
        val agora = System.currentTimeMillis()
        salvarLista(Reuniao("some", agora + 30 * min, "Some", null))
        assertNotNull(AlarmScheduler.sincronizar(c, agora))

        salvarLista()

        assertNull(AlarmScheduler.sincronizar(c))
        assertNull(c.getSystemService(AlarmManager::class.java).nextAlarmClock)
    }

    @Test
    fun sair_da_conta_tira_os_alarmes() {
        salvarLista(Reuniao("r", System.currentTimeMillis() + 30 * min, "R", null))
        assertNotNull(AlarmScheduler.sincronizar(c))

        Conta.sair(c)

        assertFalse(Conta.conectada(c))
        assertNull(c.getSystemService(AlarmManager::class.java).nextAlarmClock)
    }

    @Test
    fun toca_de_verdade_e_para_quando_mandam_parar() {
        // Começa em 2 min: já está dentro da janela de 5 min, então toca na hora
        val inicio = System.currentTimeMillis() + 2 * min
        val reuniao = Reuniao("em-cima", inicio, "Em cima da hora", "https://meet.google.com/abc")
        salvarLista(reuniao)

        AlarmScheduler.sincronizar(c)

        assertTrue("o alarme deve começar a tocar", esperar(20_000) { RingService.tocando == reuniao.chave })
        val avisos = c.getSystemService(NotificationManager::class.java).activeNotifications.map { it.id }
        assertTrue("o aviso do alarme deve estar na tela", RingService.ID_TOCANDO in avisos)

        c.startService(RingService.intent(c, RingService.ACAO_PARAR, reuniao, Tipo.ANTES))

        assertTrue("deve parar de tocar", esperar(5_000) { RingService.tocando == null })
        // Parar silencia só este toque: o do início da reunião continua agendado
        val relogio = c.getSystemService(AlarmManager::class.java).nextAlarmClock
        assertNotNull(relogio)
        assertTrue(abs(relogio!!.triggerTime - inicio) < 1_000)
    }

    @Test
    fun dispensar_cancela_os_toques_seguintes_da_reuniao() {
        val inicio = System.currentTimeMillis() + 2 * min
        val reuniao = Reuniao("vou-entrar", inicio, "Vou entrar", null)
        salvarLista(reuniao)
        AlarmScheduler.sincronizar(c)
        assertTrue(esperar(20_000) { RingService.tocando != null })

        c.startService(RingService.intent(c, RingService.ACAO_DISPENSAR, reuniao, Tipo.ANTES))

        assertTrue(esperar(5_000) { RingService.tocando == null })
        assertNull("sem mais toques para a reunião dispensada", c.getSystemService(AlarmManager::class.java).nextAlarmClock)
    }

    @Test
    fun soneca_toca_de_novo_em_dois_minutos() {
        // Começa em 4 min: toca já (janela de 5 min) e a soneca de 2 min cai antes do início
        val inicio = System.currentTimeMillis() + 4 * min
        val reuniao = Reuniao("depois", inicio, "Depois", null)
        salvarLista(reuniao)
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

        // A reunião chega com o aparelho já dormindo; o aviso de antecedência cai daqui a ~25 s
        val inicio = System.currentTimeMillis() + 5 * min + 25_000
        val reuniao = Reuniao("tela-apagada", inicio, "Tela apagada", null)
        salvarLista(reuniao)
        assertNotNull(AlarmScheduler.sincronizar(c))

        assertTrue(
            "o alarme deve tocar com o aparelho em Doze e a tela apagada",
            esperar(60_000) { RingService.tocando == reuniao.chave },
        )
        val atraso = System.currentTimeMillis() - (inicio - 5 * min)
        assertTrue("tocou com atraso de $atraso ms", atraso < 15_000)
    }

    @Test
    fun alarme_agendado_impede_o_aparelho_de_cair_no_sono_profundo() {
        salvarLista(Reuniao("logo", System.currentTimeMillis() + 15 * min, "Logo mais", null))
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

    @Test
    fun login_so_conclui_se_este_aparelho_iniciou() {
        Prefs.limparTudo(c)
        val volta = Uri.parse("alarmeagenda://conectado?t=AbCdEf0123456789_-AbCdEf")

        assertFalse("sem login iniciado, a volta é recusada", Conta.concluirLogin(c, volta))
        assertFalse(Conta.conectada(c))

        Prefs.definirVerificadorPendente(c, "verificador-do-aparelho")
        assertFalse("outro endereço é recusado", Conta.concluirLogin(c, Uri.parse("alarmeagenda://outro?t=AbCdEf0123456789_-AbCdEf")))
        assertFalse("token fora do formato é recusado", Conta.concluirLogin(c, Uri.parse("alarmeagenda://conectado?t=%3Cscript%3E")))

        assertTrue(Conta.concluirLogin(c, volta))
        assertTrue(Conta.conectada(c))
        assertEquals("verificador-do-aparelho", Prefs.verificador(c))
        assertNull("o verificador pendente é consumido", Prefs.verificadorPendente(c))
    }

    @Test
    fun tela_igual_ao_site_com_o_selo_do_app() {
        val agora = System.currentTimeMillis()
        salvarLista(Reuniao("daily", agora + 2 * 60 * min, "Daily do time", "https://meet.google.com/abc", agora + 150 * min), conta = "ana@empresa.com.br")

        ActivityScenario.launch(MainActivity::class.java).use { cena ->
            cena.onActivity { tela ->
                val textos = textosDe(tela.window.decorView)
                assertTrue("título do site: $textos", "Alarme Google Agenda 2026" in textos)
                assertTrue("selo que diferencia do site", "App Android" in textos)
                assertTrue("seção igual à do site", "Próximos eventos" in textos)
                assertTrue("a reunião da conta aparece", "Daily do time" in textos)
                assertTrue("a conta conectada aparece", "Conta: ana@empresa.com.br" in textos)
            }
            fotografar("tela-painel")
        }
    }

    @Test
    fun sem_conta_a_tela_pede_o_login_do_google() {
        Prefs.limparTudo(c)
        ActivityScenario.launch(MainActivity::class.java).use { cena ->
            cena.onActivity { tela ->
                val textos = textosDe(tela.window.decorView)
                assertTrue("tela de entrada: $textos", "Entrar com Google" in textos)
                assertTrue("App Android" in textos)
            }
            fotografar("tela-entrada")
        }
    }

    // ---- apoio ----

    /** Grava a lista como o servidor entrega (mesmo JSON de /api/app/eventos). */
    private fun salvarLista(vararg reunioes: Reuniao, conta: String = "teste@empresa.com.br") {
        val eventos = JSONArray()
        for (r in reunioes) {
            eventos.put(JSONObject().put("id", r.id).put("titulo", r.titulo).put("inicio", r.inicio).put("fim", r.fim).put("link", r.link ?: JSONObject.NULL))
        }
        val json = JSONObject().put("conta", conta).put("eventos", eventos).put("salas", JSONArray()).toString()
        Prefs.salvarDados(c, json, System.currentTimeMillis())
    }

    private fun textosDe(view: View): List<String> = when (view) {
        is TextView -> listOf(view.text.toString())
        is ViewGroup -> (0 until view.childCount).flatMap { textosDe(view.getChildAt(it)) }
        else -> emptyList()
    }

    /** Print da tela para conferir a aparência (o CI publica como artefato). */
    private fun fotografar(nome: String) {
        instr.waitForIdleSync()
        Thread.sleep(1_500)
        shell("screencap -p /data/local/tmp/$nome.png")
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
}
