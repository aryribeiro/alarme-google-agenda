package br.com.aryribeiro.alarmeagenda

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.TimeZone

/** As mesmas regras de exibição do cartão de evento do site (components/EventCard.tsx). */
class FormatosTest {
    private val min = 60_000L

    @Test
    fun `contagem regressiva igual a do site`() {
        assertEquals("AGORA", Formatos.contagem(0.0))
        assertEquals("AGORA", Formatos.contagem(-3.0))
        assertEquals("em < 1 min", Formatos.contagem(0.5))
        assertEquals("em 7 min", Formatos.contagem(7.9))
        assertEquals("em 1h 46min", Formatos.contagem(106.2))
    }

    @Test
    fun `anel enche ao longo da ultima hora`() {
        assertEquals(0f, Formatos.progresso(90.0), 0.001f)
        assertEquals(0f, Formatos.progresso(60.0), 0.001f)
        assertEquals(0.5f, Formatos.progresso(30.0), 0.001f)
        assertEquals(1f, Formatos.progresso(0.0), 0.001f)
    }

    @Test
    fun `cores por proximidade iguais as do site`() {
        assertEquals(Formatos.VERMELHO, Formatos.corAnel(5.0))
        assertEquals(Formatos.LARANJA, Formatos.corAnel(10.0))
        assertEquals(Formatos.AMARELO, Formatos.corAnel(30.0))
        assertEquals(Formatos.CINZA, Formatos.corAnel(31.0))
        assertEquals(Formatos.VERMELHO_VIVO, Formatos.corContagem(4.0))
        assertEquals(Formatos.LARANJA, Formatos.corContagem(9.0))
        assertEquals(Formatos.AMARELO, Formatos.corContagem(29.0))
        assertEquals(Formatos.CINZA, Formatos.corContagem(45.0))
    }

    @Test
    fun `lista mostra so as reunioes de hoje que nao terminaram ha mais de 30 min`() {
        val fuso = TimeZone.getTimeZone("America/Sao_Paulo")
        // 16/11/2026 12:00 em Brasília
        val agora = 1_794_841_200_000L
        val manha = Reuniao("a", agora - 3 * 60 * min, "Manhã", null, agora - 150 * min)
        val recente = Reuniao("b", agora - 60 * min, "Recente", null, agora - 20 * min)
        val tarde = Reuniao("c", agora + 2 * 60 * min, "Tarde", null, agora + 150 * min)
        val amanha = Reuniao("d", agora + 20 * 60 * min, "Amanhã", null, agora + 21 * 60 * min)

        assertEquals(listOf("b", "c"), Formatos.deHoje(listOf(tarde, amanha, recente, manha), agora, fuso).map { it.id })
    }
}
