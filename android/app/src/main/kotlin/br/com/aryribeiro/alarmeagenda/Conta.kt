package br.com.aryribeiro.alarmeagenda

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Login igual ao do site: o Google abre no navegador, com a conta da empresa, e o servidor devolve ao app
 * uma credencial presa a um verificador que nunca sai deste aparelho.
 */
object Conta {
    private val URL_SEGURA = Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING

    fun conectada(c: Context): Boolean = Prefs.token(c) != null

    fun iniciarLogin(activity: Activity) {
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val verificador = Base64.encodeToString(bytes, URL_SEGURA)
        Prefs.definirVerificadorPendente(activity, verificador)

        val desafio = Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(verificador.toByteArray()), URL_SEGURA)
        activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${Api.servidor}/app/entrar?c=$desafio")))
    }

    /** Volta do login (alarmeagenda://conectado?t=...). Só vale se este aparelho iniciou o login. */
    fun concluirLogin(c: Context, uri: Uri?): Boolean {
        if (uri?.scheme != "alarmeagenda" || uri.host != "conectado") return false
        val token = uri.getQueryParameter("t")?.takeIf { it.matches(Regex("^[A-Za-z0-9_-]{20,4096}$")) } ?: return false
        val verificador = Prefs.verificadorPendente(c) ?: return false
        Prefs.conectar(c, token, verificador)
        return true
    }

    fun sair(c: Context) {
        Prefs.desconectar(c)
        AlarmScheduler.sincronizar(c)
    }
}
