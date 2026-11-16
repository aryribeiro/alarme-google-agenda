package br.com.aryribeiro.alarmeagenda

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Toca o alarme: som em loop no canal de ALARME (o mesmo do despertador), vibração e tela cheia
 * por cima do bloqueio. Fica tocando até alguém atender ou até o tempo limite.
 */
class RingService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var player: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var volumeAnterior: Int? = null
    private val tempoEsgotado = Runnable { perdeu() }
    private var atual: Reuniao? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val reuniao = intent?.let { reuniaoDe(it) }
        when (intent?.action) {
            ACAO_TOCAR -> if (reuniao != null) iniciar(reuniao, tipoDe(intent)) else encerrar()
            // Parar: silencia só este toque (o aviso do início da reunião continua valendo)
            ACAO_PARAR -> encerrar()
            // Dispensar: a pessoa entrou na reunião; não toca mais nada dela
            ACAO_DISPENSAR -> {
                if (reuniao != null) Prefs.dispensar(this, reuniao.chave, System.currentTimeMillis())
                encerrar()
            }
            ACAO_SONECA -> {
                if (reuniao != null) Prefs.definirSoneca(this, reuniao, System.currentTimeMillis() + SONECA_MS)
                encerrar()
            }
            else -> encerrar()
        }
        return START_NOT_STICKY
    }

    private fun iniciar(reuniao: Reuniao, tipo: Tipo) {
        pararSom()
        atual = reuniao
        criarCanal(this)

        val notificacao = notificacaoTocando(reuniao, tipo)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(ID_TOCANDO, notificacao, ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED)
        } else {
            startForeground(ID_TOCANDO, notificacao)
        }

        wakeLock = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "alarmeagenda:tocando")
            .apply { acquire(LIMITE_MS + 10_000) }

        tocarSom()
        vibrar()
        tocando = reuniao.chave
        handler.removeCallbacks(tempoEsgotado)
        handler.postDelayed(tempoEsgotado, LIMITE_MS)
    }

    private fun tocarSom() {
        val audio = getSystemService(AudioManager::class.java)
        val maximo = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM)
        val atualVolume = audio.getStreamVolume(AudioManager.STREAM_ALARM)
        val minimo = (maximo * 0.7f).toInt().coerceAtLeast(1)
        // Volume de alarme zerado tornaria o app inútil; depois do toque volta ao que era
        if (atualVolume < minimo) {
            volumeAnterior = atualVolume
            runCatching { audio.setStreamVolume(AudioManager.STREAM_ALARM, minimo, 0) }
        }

        runCatching {
            val p = MediaPlayer()
            p.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            resources.openRawResourceFd(R.raw.alarme).use { afd ->
                p.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            }
            p.isLooping = true
            p.prepare()
            p.start()
            player = p
        }
    }

    private fun vibrar() {
        val vibrador = getSystemService(Vibrator::class.java) ?: return
        val atributos = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
        runCatching { vibrador.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 600, 400), 0), atributos) }
    }

    private fun pararSom() {
        player?.let { p -> runCatching { p.stop() }; p.release() }
        player = null
        getSystemService(Vibrator::class.java)?.cancel()
        volumeAnterior?.let { v ->
            runCatching { getSystemService(AudioManager::class.java).setStreamVolume(AudioManager.STREAM_ALARM, v, 0) }
        }
        volumeAnterior = null
    }

    /** Ninguém atendeu dentro do limite: para o som e deixa um aviso de alarme perdido. */
    private fun perdeu() {
        atual?.let { reuniao ->
            val aviso = Notification.Builder(this, CANAL)
                .setSmallIcon(R.drawable.ic_alarme)
                .setContentTitle(getString(R.string.alarme_perdido))
                .setContentText("${hora(reuniao.inicio)} — ${reuniao.titulo}")
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(this, REQ_ABRIR_APP, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE))
                .build()
            getSystemService(NotificationManager::class.java).notify(ID_PERDIDO, aviso)
        }
        encerrar()
    }

    private fun encerrar() {
        handler.removeCallbacks(tempoEsgotado)
        pararSom()
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        atual = null
        tocando = null
        sendBroadcast(Intent(ACAO_PAROU).setPackage(packageName))
        @Suppress("DEPRECATION")
        stopForeground(true)
        stopSelf()
        // Soneca ou dispensa mudam o que vem a seguir
        AlarmScheduler.sincronizar(this)
    }

    override fun onDestroy() {
        handler.removeCallbacks(tempoEsgotado)
        pararSom()
        wakeLock?.let { if (it.isHeld) it.release() }
        tocando = null
        super.onDestroy()
    }

    private fun notificacaoTocando(reuniao: Reuniao, tipo: Tipo): Notification {
        val telaCheia = PendingIntent.getActivity(
            this, REQ_TELA, AlarmActivity.intent(this, reuniao, tipo),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_alarme)
            .setContentTitle(titulo(this, reuniao, tipo))
            .setContentText(hora(reuniao.inicio))
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setContentIntent(telaCheia)
            .setFullScreenIntent(telaCheia, true)
            .addAction(Notification.Action.Builder(null, getString(R.string.parar), acao(ACAO_PARAR, reuniao, REQ_PARAR)).build())
            .addAction(Notification.Action.Builder(null, getString(R.string.lembrar_2_min), acao(ACAO_SONECA, reuniao, REQ_SONECA)).build())
            .build()
    }

    private fun acao(acao: String, reuniao: Reuniao, requisicao: Int): PendingIntent =
        PendingIntent.getService(this, requisicao, intent(this, acao, reuniao, Tipo.AGORA), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    companion object {
        const val ACAO_TOCAR = "br.com.aryribeiro.alarmeagenda.TOCAR"
        const val ACAO_PARAR = "br.com.aryribeiro.alarmeagenda.PARAR"
        const val ACAO_DISPENSAR = "br.com.aryribeiro.alarmeagenda.DISPENSAR"
        const val ACAO_SONECA = "br.com.aryribeiro.alarmeagenda.SONECA"
        const val ACAO_PAROU = "br.com.aryribeiro.alarmeagenda.PAROU"

        const val EXTRA_EVENT_ID = "eventId"
        const val EXTRA_INICIO = "inicio"
        const val EXTRA_TITULO = "titulo"
        const val EXTRA_LINK = "link"
        const val EXTRA_TIPO = "tipo"

        const val CANAL = "alarme_reuniao"
        const val ID_TOCANDO = 10
        const val ID_PERDIDO = 11
        const val SONECA_MS = 2 * 60_000L
        const val LIMITE_MS = 2 * 60_000L

        private const val REQ_TELA = 20
        private const val REQ_PARAR = 21
        private const val REQ_SONECA = 22
        private const val REQ_ABRIR_APP = 23

        /** Chave da reunião que está tocando agora, ou null. */
        @Volatile
        var tocando: String? = null
            private set

        fun intent(c: Context, acao: String, reuniao: Reuniao, tipo: Tipo): Intent =
            Intent(c, RingService::class.java).setAction(acao)
                .putExtra(EXTRA_EVENT_ID, reuniao.id)
                .putExtra(EXTRA_INICIO, reuniao.inicio)
                .putExtra(EXTRA_TITULO, reuniao.titulo)
                .putExtra(EXTRA_LINK, reuniao.link)
                .putExtra(EXTRA_TIPO, tipo.name)

        fun reuniaoDe(intent: Intent): Reuniao? {
            if (!intent.hasExtra(EXTRA_INICIO)) return null
            return Reuniao(
                id = intent.getStringExtra(EXTRA_EVENT_ID) ?: "",
                inicio = intent.getLongExtra(EXTRA_INICIO, 0),
                titulo = intent.getStringExtra(EXTRA_TITULO) ?: "",
                link = intent.getStringExtra(EXTRA_LINK),
            )
        }

        fun tipoDe(intent: Intent): Tipo =
            runCatching { Tipo.valueOf(intent.getStringExtra(EXTRA_TIPO) ?: "") }.getOrDefault(Tipo.AGORA)

        fun tocar(c: Context, reuniao: Reuniao, tipo: Tipo) {
            c.startForegroundService(intent(c, ACAO_TOCAR, reuniao, tipo))
        }

        fun titulo(c: Context, reuniao: Reuniao, tipo: Tipo): String = when (tipo) {
            Tipo.AGORA -> c.getString(R.string.reuniao_agora, reuniao.titulo)
            Tipo.SONECA -> c.getString(R.string.lembrete, reuniao.titulo)
            Tipo.ANTES -> {
                val minutos = ((reuniao.inicio - System.currentTimeMillis() + 59_999) / 60_000).coerceAtLeast(1)
                c.getString(R.string.reuniao_em, minutos, reuniao.titulo)
            }
        }

        fun hora(instante: Long): String = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(instante))

        fun criarCanal(c: Context) {
            val canal = NotificationChannel(CANAL, c.getString(R.string.canal_nome), NotificationManager.IMPORTANCE_HIGH).apply {
                description = c.getString(R.string.canal_descricao)
                // O som é tocado pelo serviço, em loop, no canal de alarme; o da notificação ficaria duplicado
                setSound(null, null)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            c.getSystemService(NotificationManager::class.java).createNotificationChannel(canal)
        }
    }
}
