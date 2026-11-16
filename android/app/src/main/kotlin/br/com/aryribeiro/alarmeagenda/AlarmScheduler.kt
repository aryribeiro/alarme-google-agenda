package br.com.aryribeiro.alarmeagenda

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Mantém agendado, no relógio de alarmes do Android, só o PRÓXIMO toque.
 * setAlarmClock é o mecanismo do app Relógio: dispara na hora exata mesmo com o aparelho em economia (Doze).
 */
object AlarmScheduler {
    const val ACAO_DISPARAR = "br.com.aryribeiro.alarmeagenda.DISPARAR"
    const val EXTRA_EVENT_ID = "eventId"
    const val EXTRA_INICIO = "inicio"
    const val EXTRA_TIPO = "tipo"

    private const val REQ_DISPARO = 1
    private const val REQ_MOSTRAR = 2

    fun podeAgendar(c: Context): Boolean {
        val am = c.getSystemService(AlarmManager::class.java)
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    }

    fun proximo(c: Context, agora: Long): Ponto? =
        AlarmPlanner.proximo(
            reunioes = Prefs.reunioes(c),
            agora = agora,
            tocados = Prefs.tocados(c),
            dispensadas = Prefs.dispensadas(c),
            minutosAntes = Prefs.minutosAntes(c),
            soneca = Prefs.soneca(c),
        )

    private fun intentDisparo(c: Context, ponto: Ponto?): PendingIntent {
        val intent = Intent(c, AlarmReceiver::class.java).setAction(ACAO_DISPARAR)
        if (ponto != null) {
            intent.putExtra(EXTRA_EVENT_ID, ponto.reuniao.id)
            intent.putExtra(EXTRA_INICIO, ponto.reuniao.inicio)
            intent.putExtra(EXTRA_TIPO, ponto.tipo.name)
        }
        return PendingIntent.getBroadcast(c, REQ_DISPARO, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    /** Relê a agenda e deixa o relógio de alarmes apontando para o próximo toque (ou sem nenhum). */
    fun sincronizar(c: Context, agora: Long = System.currentTimeMillis()): Ponto? {
        val am = c.getSystemService(AlarmManager::class.java)
        val ponto = proximo(c, agora)
        val disparo = intentDisparo(c, ponto)

        if (ponto == null || !podeAgendar(c)) {
            am.cancel(disparo)
            return null
        }

        val mostrar = PendingIntent.getActivity(c, REQ_MOSTRAR, Intent(c, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        am.setAlarmClock(AlarmManager.AlarmClockInfo(ponto.quando, mostrar), disparo)
        return ponto
    }
}
