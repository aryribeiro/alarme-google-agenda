package br.com.aryribeiro.alarmeagenda

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiTest {
    @Test
    fun `le a resposta do servidor com reunioes e salas`() {
        val json = """
            {"conta":"ana@empresa.com.br",
             "eventos":[
               {"id":"abc_20261116T180000Z","titulo":"Daily","inicio":1800000000000,"fim":1800001800000,"link":"https://meet.google.com/abc"},
               {"id":"def","titulo":"Sem link","inicio":1800003600000,"fim":1800003600000,"link":null}
             ],
             "salas":[{"nome":"SALA INTERNA 1","url":"https://meet.google.com/sala"}]}
        """.trimIndent()

        val dados = Api.ler(json)

        assertEquals("ana@empresa.com.br", dados.conta)
        assertEquals(
            listOf(
                Reuniao("abc_20261116T180000Z", 1800000000000, "Daily", "https://meet.google.com/abc", 1800001800000),
                Reuniao("def", 1800003600000, "Sem link", null, 1800003600000),
            ),
            dados.reunioes,
        )
        assertEquals(listOf(Sala("SALA INTERNA 1", "https://meet.google.com/sala")), dados.salas)
    }

    @Test
    fun `campos ausentes nao derrubam o app`() {
        val dados = Api.ler("""{"eventos":[{"id":"x","inicio":5}]}""")
        assertEquals("", dados.conta)
        assertEquals(listOf(Reuniao("x", 5, "(Sem título)", null, 5)), dados.reunioes)
        assertTrue(dados.salas.isEmpty())
        assertNull(dados.tokenNovo)
    }

    @Test
    fun `credencial renovada pelo servidor vem junto`() {
        assertEquals("NovoToken_abc-123", Api.ler("""{"eventos":[],"token":"NovoToken_abc-123"}""").tokenNovo)
        assertNull(Api.ler("""{"eventos":[],"token":""}""").tokenNovo)
    }

    @Test
    fun `item sem id ou sem inicio e ignorado`() {
        val dados = Api.ler("""{"eventos":[{"titulo":"sem id","inicio":5},{"id":"y"},{"id":"z","inicio":7}]}""")
        assertEquals(listOf("z"), dados.reunioes.map { it.id })
    }
}
