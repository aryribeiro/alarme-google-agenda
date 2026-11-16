package br.com.aryribeiro.alarmeagenda

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlin.concurrent.thread

/**
 * Busca as reuniões no servidor a cada 10 minutos, inclusive com a tela apagada, e reagenda o alarme.
 * O alarme em si não depende da rede: toca com o que foi buscado por último.
 */
object Atualizacao {
    const val INTERVALO_MS = 10 * 60_000L
    private const val ACAO = "br.com.aryribeiro.alarmeagenda.ATUALIZAR"
    private const val REQ = 3
    private const val ID_RECONECTAR = 12

    fun agendar(c: Context, emMs: Long = INTERVALO_MS) {
        val am = c.getSystemService(AlarmManager::class.java)
        val pi = PendingIntent.getBroadcast(c, REQ, Intent(c, AtualizarReceiver::class.java).setAction(ACAO), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        if (!Conta.conectada(c)) {
            am.cancel(pi)
            return
        }
        val quando = System.currentTimeMillis() + emMs
        if (AlarmScheduler.podeAgendar(c)) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quando, pi)
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quando, pi)
        }
    }

    /** Busca agora (bloqueia: chamar fora da thread principal). Devolve true se trouxe dados novos. */
    fun executar(c: Context): Boolean {
        val token = Prefs.token(c) ?: return false
        val verificador = Prefs.verificador(c) ?: return false
        return when (val r = Api.buscar(token, verificador)) {
            is Api.Resultado.Ok -> {
                // Credencial renovada pelo servidor: troca, mantendo o verificador deste aparelho
                runCatching { Api.ler(r.json).tokenNovo }.getOrNull()?.let { Prefs.conectar(c, it, verificador) }
                Prefs.salvarDados(c, r.json, System.currentTimeMillis())
                AlarmScheduler.sincronizar(c)
                true
            }
            is Api.Resultado.Reconectar -> {
                // Parar calado seria o pior defeito: a pessoa acharia que está protegida
                Prefs.desconectar(c)
                AlarmScheduler.sincronizar(c)
                avisarReconectar(c)
                false
            }
            is Api.Resultado.Falha -> false
        }
    }

    /** Busca em segundo plano e avisa a tela quando terminar. */
    fun executarEmSegundoPlano(c: Context, aoTerminar: (() -> Unit)? = null) {
        val app = c.applicationContext
        thread(name = "atualizar-reunioes") {
            executar(app)
            agendar(app)
            aoTerminar?.invoke()
        }
    }

    private fun avisarReconectar(c: Context) {
        RingService.criarCanal(c)
        val abrir = PendingIntent.getActivity(c, REQ, Intent(c, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val aviso = Notification.Builder(c, RingService.CANAL)
            .setSmallIcon(R.drawable.ic_alarme)
            .setContentTitle(c.getString(R.string.reconectar_titulo))
            .setContentText(c.getString(R.string.reconectar_texto))
            .setAutoCancel(true)
            .setContentIntent(abrir)
            .build()
        c.getSystemService(NotificationManager::class.java).notify(ID_RECONECTAR, aviso)
    }
}

class AtualizarReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pendente = goAsync()
        thread(name = "atualizar-reunioes") {
            try {
                Atualizacao.executar(context)
            } finally {
                Atualizacao.agendar(context)
                pendente.finish()
            }
        }
    }
}
