package br.com.aryribeiro.alarmeagenda

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AlarmPlannerTest {
    private val min = 60_000L
    private val hora = 60 * min
    private val inicio = 1_800_000_000_000L
    private val daily = Reuniao(eventId = 7, inicio = inicio, titulo = "Daily", link = null)

    private fun proximo(
        agora: Long,
        reunioes: List<Reuniao> = listOf(daily),
        tocados: Set<String> = emptySet(),
        dispensadas: Set<String> = emptySet(),
        minutosAntes: Int = 5,
        soneca: Ponto? = null,
    ) = AlarmPlanner.proximo(reunioes, agora, tocados, dispensadas, minutosAntes, soneca)

    @Test
    fun `longe da reuniao agenda o aviso de antecedencia`() {
        assertEquals(Ponto(daily, Tipo.ANTES, inicio - 5 * min), proximo(inicio - hora))
    }

    @Test
    fun `antecedencia configuravel`() {
        assertEquals(inicio - 15 * min, proximo(inicio - hora, minutosAntes = 15)?.quando)
    }

    @Test
    fun `depois do aviso de antecedencia o proximo e o inicio`() {
        val tocados = setOf(AlarmPlanner.chaveDe(daily, Tipo.ANTES))
        assertEquals(Ponto(daily, Tipo.AGORA, inicio), proximo(inicio - 4 * min, tocados = tocados))
    }

    @Test
    fun `aberto dentro da janela sem ter tocado toca ja o aviso de antecedencia`() {
        val agora = inicio - 3 * min
        assertEquals(Ponto(daily, Tipo.ANTES, agora), proximo(agora))
    }

    @Test
    fun `reuniao ja comecou e nao tocou toca ja como agora`() {
        val agora = inicio + 2 * min
        assertEquals(Ponto(daily, Tipo.AGORA, agora), proximo(agora))
    }

    @Test
    fun `no instante exato do inicio e agora`() {
        assertEquals(Tipo.AGORA, proximo(inicio)?.tipo)
    }

    @Test
    fun `depois de tocar agora nao toca mais`() {
        assertNull(proximo(inicio + min, tocados = setOf(AlarmPlanner.chaveDe(daily, Tipo.AGORA))))
    }

    @Test
    fun `reuniao comecada ha cinco minutos ou mais nao toca`() {
        assertNull(proximo(inicio + 5 * min))
        assertEquals(Tipo.AGORA, proximo(inicio + 5 * min - 1)?.tipo)
    }

    @Test
    fun `reuniao dispensada nao toca`() {
        assertNull(proximo(inicio - 3 * min, dispensadas = setOf(daily.chave)))
    }

    @Test
    fun `reuniao remarcada volta a tocar no horario novo`() {
        val remarcada = daily.copy(inicio = inicio + hora)
        val tocados = setOf(AlarmPlanner.chaveDe(daily, Tipo.ANTES), AlarmPlanner.chaveDe(daily, Tipo.AGORA))
        val ponto = proximo(inicio + 10 * min, reunioes = listOf(remarcada), tocados = tocados, dispensadas = setOf(daily.chave))
        assertEquals(Ponto(remarcada, Tipo.ANTES, remarcada.inicio - 5 * min), ponto)
    }

    @Test
    fun `entre varias reunioes escolhe o toque mais proximo`() {
        val review = Reuniao(8, inicio - 30 * min, "Review", null)
        assertEquals(review, proximo(inicio - hora, reunioes = listOf(daily, review))?.reuniao)
    }

    @Test
    fun `no mesmo instante reuniao agora vence aviso de antecedencia de outra`() {
        val outra = Reuniao(9, inicio + 5 * min, "Outra", null)
        val tocados = setOf(AlarmPlanner.chaveDe(daily, Tipo.ANTES))
        val ponto = proximo(inicio - min, reunioes = listOf(outra, daily), tocados = tocados)
        // outra: ANTES em inicio; daily: AGORA em inicio
        assertEquals(Ponto(daily, Tipo.AGORA, inicio), ponto)
    }

    @Test
    fun `sem reunioes nao ha toque`() {
        assertNull(proximo(inicio, reunioes = emptyList()))
    }

    @Test
    fun `soneca toca no horario pedido e antes de reuniao mais distante`() {
        val soneca = Ponto(daily, Tipo.SONECA, inicio - 20 * min)
        assertEquals(soneca, proximo(inicio - 22 * min, soneca = soneca))
    }

    @Test
    fun `soneca vencida toca ja`() {
        val agora = inicio + 7 * min
        val soneca = Ponto(daily, Tipo.SONECA, inicio + 6 * min)
        assertEquals(Ponto(daily, Tipo.SONECA, agora), proximo(agora, soneca = soneca))
    }

    @Test
    fun `soneca de reuniao dispensada nao toca`() {
        val soneca = Ponto(daily, Tipo.SONECA, inicio + 6 * min)
        assertNull(proximo(inicio + 6 * min, dispensadas = setOf(daily.chave), soneca = soneca))
    }

    @Test
    fun `ao tocar agora marca tambem o aviso de antecedencia`() {
        assertEquals(
            listOf("7|$inicio|ANTES", "7|$inicio|AGORA"),
            AlarmPlanner.chavesAoTocar(Ponto(daily, Tipo.AGORA, inicio)),
        )
        assertEquals(listOf("7|$inicio|ANTES"), AlarmPlanner.chavesAoTocar(Ponto(daily, Tipo.ANTES, inicio)))
        assertEquals(emptyList<String>(), AlarmPlanner.chavesAoTocar(Ponto(daily, Tipo.SONECA, inicio)))
    }

    @Test
    fun `agenda lista os toques futuros em ordem e ignora dispensadas`() {
        val review = Reuniao(8, inicio - 30 * min, "Review", null)
        val fora = Reuniao(9, inicio + hora, "Fora", null)
        val lista = AlarmPlanner.agenda(listOf(daily, fora, review), inicio - hora, emptySet(), setOf(fora.chave), 5)
        assertEquals(listOf(review, daily), lista.map { it.reuniao })
    }

    @Test
    fun `podar descarta marcas com mais de 24 horas e chaves ilegiveis`() {
        val agora = inicio
        val velha = "1|${agora - 24 * hora - 1}|AGORA"
        val noLimite = "2|${agora - 24 * hora}|AGORA"
        val dispensada = "3|${agora + hora}"
        assertEquals(setOf(noLimite, dispensada), AlarmPlanner.podar(setOf(velha, noLimite, dispensada, "lixo"), agora))
    }
}
