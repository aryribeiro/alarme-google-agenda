package br.com.aryribeiro.alarmeagenda

import android.content.Context
import android.content.SharedPreferences

/** O pouco que o app guarda: tudo fica no aparelho. */
object Prefs {
    private const val ARQUIVO = "alarme"
    private const val MINUTOS = "minutos_antes"
    private const val CALENDARIOS = "calendarios"
    private const val TOCADOS = "tocados"
    private const val DISPENSADAS = "dispensadas"
    private const val SONECA = "soneca"

    const val MINUTOS_PADRAO = 5

    private fun sp(c: Context): SharedPreferences = c.getSharedPreferences(ARQUIVO, Context.MODE_PRIVATE)

    fun minutosAntes(c: Context): Int = sp(c).getInt(MINUTOS, MINUTOS_PADRAO)

    fun definirMinutosAntes(c: Context, minutos: Int) = sp(c).edit().putInt(MINUTOS, minutos).apply()

    /** null = o usuário nunca escolheu: vale o padrão (agendas principais). */
    fun calendarios(c: Context): Set<String>? = sp(c).getStringSet(CALENDARIOS, null)?.toSet()

    fun definirCalendarios(c: Context, ids: Set<String>) = sp(c).edit().putStringSet(CALENDARIOS, ids).apply()

    fun tocados(c: Context): Set<String> = sp(c).getStringSet(TOCADOS, emptySet())!!.toSet()

    fun marcarTocados(c: Context, chaves: List<String>, agora: Long) {
        val novo = AlarmPlanner.podar(tocados(c) + chaves, agora)
        sp(c).edit().putStringSet(TOCADOS, novo).apply()
    }

    fun dispensadas(c: Context): Set<String> = sp(c).getStringSet(DISPENSADAS, emptySet())!!.toSet()

    fun dispensar(c: Context, chaveReuniao: String, agora: Long) {
        val novo = AlarmPlanner.podar(dispensadas(c) + chaveReuniao, agora)
        sp(c).edit().putStringSet(DISPENSADAS, novo).apply()
    }

    fun soneca(c: Context): Ponto? {
        val partes = sp(c).getString(SONECA, null)?.split('\u0001') ?: return null
        if (partes.size != 5) return null
        val eventId = partes[0].toLongOrNull() ?: return null
        val inicio = partes[1].toLongOrNull() ?: return null
        val quando = partes[2].toLongOrNull() ?: return null
        return Ponto(Reuniao(eventId, inicio, partes[3], partes[4].ifEmpty { null }), Tipo.SONECA, quando)
    }

    fun definirSoneca(c: Context, reuniao: Reuniao, quando: Long) {
        val valor = listOf(reuniao.eventId, reuniao.inicio, quando, reuniao.titulo, reuniao.link ?: "").joinToString("\u0001")
        sp(c).edit().putString(SONECA, valor).apply()
    }

    fun limparSoneca(c: Context) = sp(c).edit().remove(SONECA).apply()

    fun limparTudo(c: Context) = sp(c).edit().clear().commit()
}
