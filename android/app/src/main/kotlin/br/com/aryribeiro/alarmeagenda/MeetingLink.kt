package br.com.aryribeiro.alarmeagenda

/** Acha o link da reunião no texto do evento (descrição e local), como o web app faz. */
object MeetingLink {
    private val URL = Regex("""https?://[^\s<>"',)]+""", RegexOption.IGNORE_CASE)

    private val SERVICOS = listOf(
        "meet.google.com", "zoom.us", "teams.microsoft.com", "teams.live.com", "webex.com", "chime.aws",
        "bluejeans.com", "gotomeeting.com", "joinvirtualevent", "whereby.com", "around.co", "meet.jit.si",
    )

    fun extrair(vararg textos: String?): String? {
        val urls = textos.filterNotNull().flatMap { texto -> URL.findAll(texto).map { it.value.trimEnd('.', ';') } }
        // Link de serviço de reunião vence qualquer outro link que esteja no texto
        return urls.firstOrNull { url -> SERVICOS.any { url.lowercase().contains(it) } } ?: urls.firstOrNull()
    }
}
