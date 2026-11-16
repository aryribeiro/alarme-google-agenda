package br.com.aryribeiro.alarmeagenda

import java.util.Calendar
import java.util.TimeZone

/** Regras de exibição copiadas do cartão de evento do site (components/EventCard.tsx), para o app ficar igual. */
object Formatos {
    const val VERMELHO = 0xFFFF1744.toInt()
    const val VERMELHO_VIVO = 0xFFFF1744.toInt()
    const val LARANJA = 0xFFF57C00.toInt()
    const val AMARELO = 0xFFF9A825.toInt()
    const val CINZA = 0xFF9E9E9E.toInt()

    private const val MINUTO = 60_000L

    fun minutosAte(reuniao: Reuniao, agora: Long): Double = (reuniao.inicio - agora) / MINUTO.toDouble()

    fun contagem(minutos: Double): String = when {
        minutos <= 0 -> "AGORA"
        minutos < 1 -> "em < 1 min"
        minutos < 60 -> "em ${minutos.toInt()} min"
        else -> "em ${(minutos / 60).toInt()}h ${(minutos % 60).toInt()}min"
    }

    /** Fração do anel: vazio a 60 min ou mais, cheio no início. */
    fun progresso(minutos: Double): Float = when {
        minutos <= 0 -> 1f
        minutos >= 60 -> 0f
        else -> ((60 - minutos) / 60).toFloat()
    }

    fun corAnel(minutos: Double): Int = when {
        minutos <= 5 -> VERMELHO
        minutos <= 10 -> LARANJA
        minutos <= 30 -> AMARELO
        else -> CINZA
    }

    /** Cor do texto "em X min": níveis do site (crítico 5, urgente 10, aviso 30). */
    fun corContagem(minutos: Double): Int = when {
        minutos <= 5 -> VERMELHO_VIVO
        minutos <= 10 -> LARANJA
        minutos <= 30 -> AMARELO
        else -> CINZA
    }

    /** O que a lista mostra, como no site: reuniões de hoje que não terminaram há mais de 30 min. */
    fun deHoje(reunioes: List<Reuniao>, agora: Long, fuso: TimeZone = TimeZone.getDefault()): List<Reuniao> {
        val hoje = dia(agora, fuso)
        return reunioes
            .filter { dia(it.inicio, fuso) == hoje && it.fim > agora - 30 * MINUTO }
            .sortedBy { it.inicio }
    }

    private fun dia(instante: Long, fuso: TimeZone): Int {
        val cal = Calendar.getInstance(fuso).apply { timeInMillis = instante }
        return cal.get(Calendar.YEAR) * 1000 + cal.get(Calendar.DAY_OF_YEAR)
    }
}
