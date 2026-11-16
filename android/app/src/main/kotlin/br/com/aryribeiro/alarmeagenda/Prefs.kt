package br.com.aryribeiro.alarmeagenda

import android.content.Context
import android.content.SharedPreferences

/** O pouco que o app guarda, só neste aparelho (sem backup): credencial, última lista de reuniões e o que já tocou. */
object Prefs {
    private const val ARQUIVO = "alarme"
    private const val MINUTOS = "minutos_antes"
    private const val TOCADOS = "tocados"
    private const val DISPENSADAS = "dispensadas"
    private const val SONECA = "soneca"
    private const val TOKEN = "token"
    private const val VERIFICADOR = "verificador"
    private const val VERIFICADOR_PENDENTE = "verificador_pendente"
    private const val DADOS = "dados"
    private const val ATUALIZADO_EM = "atualizado_em"

    const val MINUTOS_PADRAO = 5

    private fun sp(c: Context): SharedPreferences = c.getSharedPreferences(ARQUIVO, Context.MODE_PRIVATE)

    // ---- conta ----

    fun token(c: Context): String? = sp(c).getString(TOKEN, null)

    fun verificador(c: Context): String? = sp(c).getString(VERIFICADOR, null)

    fun verificadorPendente(c: Context): String? = sp(c).getString(VERIFICADOR_PENDENTE, null)

    fun definirVerificadorPendente(c: Context, verificador: String) =
        sp(c).edit().putString(VERIFICADOR_PENDENTE, verificador).commit()

    fun conectar(c: Context, token: String, verificador: String) =
        sp(c).edit().putString(TOKEN, token).putString(VERIFICADOR, verificador).remove(VERIFICADOR_PENDENTE).commit()

    /** Sai da conta: some a credencial e a lista de reuniões (sem lista, nenhum alarme). */
    fun desconectar(c: Context) =
        sp(c).edit().remove(TOKEN).remove(VERIFICADOR).remove(DADOS).remove(ATUALIZADO_EM).remove(SONECA).commit()

    // ---- reuniões ----

    fun salvarDados(c: Context, json: String, quando: Long) =
        sp(c).edit().putString(DADOS, json).putLong(ATUALIZADO_EM, quando).commit()

    fun dados(c: Context): Dados? = sp(c).getString(DADOS, null)?.let { runCatching { Api.ler(it) }.getOrNull() }

    fun reunioes(c: Context): List<Reuniao> = dados(c)?.reunioes ?: emptyList()

    fun atualizadoEm(c: Context): Long = sp(c).getLong(ATUALIZADO_EM, 0)

    // ---- alarme ----

    fun minutosAntes(c: Context): Int = sp(c).getInt(MINUTOS, MINUTOS_PADRAO)

    fun definirMinutosAntes(c: Context, minutos: Int) = sp(c).edit().putInt(MINUTOS, minutos).apply()

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
        val inicio = partes[1].toLongOrNull() ?: return null
        val quando = partes[2].toLongOrNull() ?: return null
        return Ponto(Reuniao(partes[0], inicio, partes[3], partes[4].ifEmpty { null }), Tipo.SONECA, quando)
    }

    fun definirSoneca(c: Context, reuniao: Reuniao, quando: Long) {
        val valor = listOf(reuniao.id, reuniao.inicio, quando, reuniao.titulo, reuniao.link ?: "").joinToString("\u0001")
        sp(c).edit().putString(SONECA, valor).apply()
    }

    fun limparSoneca(c: Context) = sp(c).edit().remove(SONECA).apply()

    fun limparTudo(c: Context) = sp(c).edit().clear().commit()
}
