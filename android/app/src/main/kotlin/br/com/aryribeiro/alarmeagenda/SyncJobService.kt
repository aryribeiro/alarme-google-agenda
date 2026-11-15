package br.com.aryribeiro.alarmeagenda

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.provider.CalendarContract

/**
 * Reagenda o alarme quando a agenda do aparelho muda (reunião criada, movida, cancelada)
 * e, como rede de segurança, a cada 30 minutos.
 */
class SyncJobService : JobService() {
    override fun onStartJob(params: JobParameters): Boolean {
        AlarmScheduler.sincronizar(this)
        // O gatilho de mudança vale para um disparo só: precisa ser armado de novo
        if (params.jobId == JOB_MUDANCA) agendarMudanca(this)
        return false
    }

    override fun onStopJob(params: JobParameters): Boolean = false

    companion object {
        private const val JOB_MUDANCA = 1
        private const val JOB_PERIODICO = 2
        private const val MEIA_HORA = 30 * 60_000L

        fun agendar(c: Context) {
            agendarMudanca(c)
            agendarPeriodico(c)
        }

        private fun agendarMudanca(c: Context) {
            val gatilho = JobInfo.TriggerContentUri(CalendarContract.CONTENT_URI, JobInfo.TriggerContentUri.FLAG_NOTIFY_FOR_DESCENDANTS)
            val job = JobInfo.Builder(JOB_MUDANCA, ComponentName(c, SyncJobService::class.java))
                .addTriggerContentUri(gatilho)
                .setTriggerContentUpdateDelay(1_000)
                .setTriggerContentMaxDelay(5_000)
                .build()
            c.getSystemService(JobScheduler::class.java).schedule(job)
        }

        private fun agendarPeriodico(c: Context) {
            val scheduler = c.getSystemService(JobScheduler::class.java)
            if (scheduler.getPendingJob(JOB_PERIODICO) != null) return
            val job = JobInfo.Builder(JOB_PERIODICO, ComponentName(c, SyncJobService::class.java))
                .setPeriodic(MEIA_HORA)
                .setPersisted(true)
                .build()
            scheduler.schedule(job)
        }
    }
}
