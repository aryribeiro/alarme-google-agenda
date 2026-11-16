package br.com.aryribeiro.alarmeagenda

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Chamado pelo relógio de alarmes do Android na hora do toque. */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != AlarmScheduler.ACAO_DISPARAR) return
        val agora = System.currentTimeMillis()
        val ponto = pontoValido(context, intent, agora)

        if (ponto != null) {
            Prefs.marcarTocados(context, AlarmPlanner.chavesAoTocar(ponto), agora)
            RingService.tocar(context, ponto.reuniao, ponto.tipo)
        }
        // Com ou sem toque, deixa agendado o que vem depois
        AlarmScheduler.sincronizar(context, agora)
    }

    /**
     * Confere na última lista do servidor, na hora do toque, se a reunião ainda existe naquele horário.
     * Cancelada, remarcada ou recusada depois do agendamento: não toca.
     */
    private fun pontoValido(c: Context, intent: Intent, agora: Long): Ponto? {
        val tipo = runCatching { Tipo.valueOf(intent.getStringExtra(AlarmScheduler.EXTRA_TIPO) ?: "") }.getOrNull() ?: return null
        val eventId = intent.getStringExtra(AlarmScheduler.EXTRA_EVENT_ID) ?: return null
        val inicio = intent.getLongExtra(AlarmScheduler.EXTRA_INICIO, Long.MIN_VALUE)

        if (tipo == Tipo.SONECA) {
            val soneca = Prefs.soneca(c)
            Prefs.limparSoneca(c)
            return soneca?.takeIf { it.reuniao.chave !in Prefs.dispensadas(c) }
        }

        val reuniao = Prefs.reunioes(c).firstOrNull { it.id == eventId && it.inicio == inicio } ?: return null
        if (reuniao.chave in Prefs.dispensadas(c)) return null
        return Ponto(reuniao, tipo, agora)
    }
}

/** Reinício do aparelho, atualização do app e mudança de hora apagam os alarmes: agenda de novo. */
class SistemaReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        AlarmScheduler.sincronizar(context)
        // Busca a lista nova logo depois (e a cada 10 min a partir daí)
        Atualizacao.agendar(context, emMs = 30_000)
    }
}
