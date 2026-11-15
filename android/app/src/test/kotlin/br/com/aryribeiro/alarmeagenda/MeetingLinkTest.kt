package br.com.aryribeiro.alarmeagenda

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MeetingLinkTest {
    @Test
    fun `acha o link do Meet no bloco que o Google Agenda poe na descricao`() {
        val descricao = "Pauta da semana\n-::~:~::~:~:~:~::~:~::-\nParticipar com o Google Meet: https://meet.google.com/abc-defg-hij\n" +
            "Saiba mais sobre o Meet em: https://support.google.com/a/users/answer/9282720"
        assertEquals("https://meet.google.com/abc-defg-hij", MeetingLink.extrair(descricao, null))
    }

    @Test
    fun `link de servico de reuniao vence outro link que venha antes`() {
        val descricao = "Ata em https://docs.exemplo.com/ata e sala em https://us02web.zoom.us/j/123?pwd=abc."
        assertEquals("https://us02web.zoom.us/j/123?pwd=abc", MeetingLink.extrair(descricao))
    }

    @Test
    fun `procura tambem no local do evento`() {
        assertEquals("https://teams.microsoft.com/l/meetup-join/xyz", MeetingLink.extrair("sem link", "https://teams.microsoft.com/l/meetup-join/xyz"))
    }

    @Test
    fun `sem servico conhecido devolve o primeiro link`() {
        assertEquals("https://intranet.exemplo.com/sala", MeetingLink.extrair("Entrar: https://intranet.exemplo.com/sala, depois https://outro.exemplo.com"))
    }

    @Test
    fun `sem link devolve nulo`() {
        assertNull(MeetingLink.extrair("Reunião presencial na sala 3", null))
        assertNull(MeetingLink.extrair(null, null))
    }
}
