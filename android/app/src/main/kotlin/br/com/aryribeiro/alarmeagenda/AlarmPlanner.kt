package br.com.aryribeiro.alarmeagenda

/** Reunião lida da agenda do aparelho. */
data class Reuniao(
    val eventId: Long,
    val inicio: Long,
    val titulo: String,
    val link: String?,
) {
    /** O início entra na chave: reunião remarcada volta a tocar no horário novo. */
    val chave: String get() = "$eventId|$inicio"
}

enum class Tipo { ANTES, AGORA, SONECA }

/** Um toque de alarme: qual reunião, por quê e em que instante. */
data class Ponto(val reuniao: Reuniao, val tipo: Tipo, val quando: Long) {
    val chave: String get() = "${reuniao.chave}|$tipo"
}

/**
 * Regra pura do alarme: dado o que há na agenda e o que já tocou, qual é o próximo toque.
 * Sem Android e sem relógio próprio: o "agora" vem de fora.
 */
object AlarmPlanner {
    private const val MINUTO = 60_000L

    /** Depois disso a reunião já vai longe: tocar seria ruído. */
    const val ATRASO_MAX = 5 * MINUTO

    fun chaveDe(reuniao: Reuniao, tipo: Tipo): String = "${reuniao.chave}|$tipo"

    /** Chaves que passam a contar como tocadas quando este ponto toca. */
    fun chavesAoTocar(ponto: Ponto): List<String> = when (ponto.tipo) {
        // Quem ouviu "reunião agora" não precisa ouvir depois o aviso de antecedência
        Tipo.AGORA -> listOf(chaveDe(ponto.reuniao, Tipo.ANTES), chaveDe(ponto.reuniao, Tipo.AGORA))
        Tipo.ANTES -> listOf(chaveDe(ponto.reuniao, Tipo.ANTES))
        Tipo.SONECA -> emptyList()
    }

    private fun pontoDaReuniao(reuniao: Reuniao, agora: Long, tocados: Set<String>, minutosAntes: Int): Ponto? {
        if (agora >= reuniao.inicio + ATRASO_MAX) return null

        val agoraTocado = chaveDe(reuniao, Tipo.AGORA) in tocados
        val antesTocado = chaveDe(reuniao, Tipo.ANTES) in tocados
        val horaAntes = reuniao.inicio - minutosAntes * MINUTO

        return when {
            agoraTocado -> null
            // Já começou e ainda não tocou: toca já
            agora >= reuniao.inicio -> Ponto(reuniao, Tipo.AGORA, agora)
            antesTocado -> Ponto(reuniao, Tipo.AGORA, reuniao.inicio)
            // Dentro da janela de antecedência sem ter tocado (app aberto em cima da hora): toca já
            agora >= horaAntes -> Ponto(reuniao, Tipo.ANTES, agora)
            else -> Ponto(reuniao, Tipo.ANTES, horaAntes)
        }
    }

    fun proximo(
        reunioes: List<Reuniao>,
        agora: Long,
        tocados: Set<String>,
        dispensadas: Set<String>,
        minutosAntes: Int,
        soneca: Ponto? = null,
    ): Ponto? {
        val candidatos = reunioes
            .filter { it.chave !in dispensadas }
            .mapNotNull { pontoDaReuniao(it, agora, tocados, minutosAntes) }
            .toMutableList()

        if (soneca != null && soneca.reuniao.chave !in dispensadas) {
            candidatos += soneca.copy(quando = maxOf(soneca.quando, agora))
        }

        // Empate no instante: "reunião agora" vence o aviso de antecedência de outra
        return candidatos.minWithOrNull(compareBy<Ponto> { it.quando }.thenBy { if (it.tipo == Tipo.AGORA) 0 else 1 })
    }

    /** Todos os toques ainda por vir, em ordem (para mostrar na tela). */
    fun agenda(reunioes: List<Reuniao>, agora: Long, tocados: Set<String>, dispensadas: Set<String>, minutosAntes: Int): List<Ponto> =
        reunioes
            .filter { it.chave !in dispensadas }
            .mapNotNull { pontoDaReuniao(it, agora, tocados, minutosAntes) }
            .sortedBy { it.quando }

    /** Mantém só as marcas de reuniões das últimas 24 horas. */
    fun podar(chaves: Set<String>, agora: Long): Set<String> =
        chaves.filter { chave ->
            val inicio = chave.split('|').getOrNull(1)?.toLongOrNull() ?: return@filter false
            inicio >= agora - 24 * 60 * MINUTO
        }.toSet()
}
