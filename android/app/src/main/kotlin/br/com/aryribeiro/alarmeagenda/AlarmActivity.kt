package br.com.aryribeiro.alarmeagenda

import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.LinearLayout

/** Tela vermelha do alarme: aparece por cima da tela de bloqueio e acende o visor. */
class AlarmActivity : Activity() {
    private var reuniao: Reuniao? = null

    private val aoParar = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) = finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        acenderSobreBloqueio()
        registrarParada()
        montar(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        montar(intent)
    }

    override fun onDestroy() {
        unregisterReceiver(aoParar)
        super.onDestroy()
    }

    private fun acenderSobreBloqueio() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun registrarParada() {
        val filtro = IntentFilter(RingService.ACAO_PAROU)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(aoParar, filtro, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(aoParar, filtro)
        }
    }

    private fun montar(intent: Intent) {
        val r = RingService.reuniaoDe(intent) ?: return finish()
        val tipo = RingService.tipoDe(intent)
        reuniao = r

        val raiz = Ui.coluna(this, 24).apply {
            setBackgroundColor(Ui.VERMELHO_ESCURO)
            gravity = Gravity.CENTER
            fitsSystemWindows = true
        }
        raiz.addView(Ui.centralizado(Ui.texto(this, if (tipo == Tipo.AGORA) "🚨" else "⚠️", 56f)))
        raiz.addView(Ui.comMargem(this, Ui.centralizado(Ui.texto(this, RingService.titulo(this, r, tipo), 26f, negrito = true)), 16))
        raiz.addView(Ui.comMargem(this, Ui.centralizado(Ui.texto(this, RingService.hora(r.inicio), 64f, negrito = true)), 8))

        raiz.addView(Ui.comMargem(this, Ui.botao(this, getString(R.string.entrar_na_reuniao), Ui.VERDE) { entrar(r) }, 32))
        raiz.addView(Ui.comMargem(this, Ui.botao(this, getString(R.string.lembrar_2_min), Ui.LARANJA) { comandar(RingService.ACAO_SONECA, r) }, 12))
        raiz.addView(Ui.comMargem(this, Ui.botao(this, getString(R.string.parar), Ui.CARTAO, Ui.TEXTO) { comandar(RingService.ACAO_PARAR, r) }, 12))

        setContentView(raiz, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT))
    }

    private fun comandar(acao: String, r: Reuniao) {
        startService(RingService.intent(this, acao, r, Tipo.AGORA))
        finish()
    }

    private fun entrar(r: Reuniao) {
        val abrir = {
            runCatching { startActivity(intentReuniao(r).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            comandar(RingService.ACAO_DISPENSAR, r)
        }
        val bloqueio = getSystemService(KeyguardManager::class.java)
        if (!bloqueio.isKeyguardLocked) return abrir()

        // Abrir o link exige o aparelho desbloqueado: pede o desbloqueio e só então abre
        bloqueio.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
            override fun onDismissSucceeded() = abrir()
        })
    }

    // Sem link de reunião: abre a agenda do Google no navegador
    private fun intentReuniao(r: Reuniao): Intent =
        Intent(Intent.ACTION_VIEW, Uri.parse(r.link ?: "https://calendar.google.com/calendar/r"))


    companion object {
        fun intent(c: Context, reuniao: Reuniao, tipo: Tipo): Intent =
            Intent(c, AlarmActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtras(RingService.intent(c, RingService.ACAO_TOCAR, reuniao, tipo))
    }
}
