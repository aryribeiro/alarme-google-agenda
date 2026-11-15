package br.com.aryribeiro.alarmeagenda

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView

/** Tela principal: o que falta permitir, quais agendas valem, os próximos alarmes e o teste. */
class MainActivity : Activity() {

    override fun onResume() {
        super.onResume()
        RingService.criarCanal(this)
        AlarmScheduler.sincronizar(this)
        SyncJobService.agendar(this)
        montar()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        AlarmScheduler.sincronizar(this)
        montar()
    }

    private fun montar() {
        val raiz = Ui.coluna(this, 20).apply { fitsSystemWindows = true }
        raiz.addView(Ui.texto(this, getString(R.string.app_name), 22f, negrito = true))
        raiz.addView(Ui.comMargem(this, Ui.texto(this, getString(R.string.resumo), 14f, Ui.APAGADO), 4))

        val pendencias = pendencias()
        if (pendencias.isEmpty()) {
            raiz.addView(Ui.comMargem(this, Ui.texto(this, getString(R.string.tudo_pronto), 15f, Ui.VERDE, negrito = true), 20))
        } else {
            raiz.addView(Ui.comMargem(this, Ui.texto(this, getString(R.string.falta_permitir), 15f, Ui.LARANJA, negrito = true), 20))
            for (p in pendencias) {
                raiz.addView(Ui.comMargem(this, Ui.texto(this, p.explicacao, 13f, Ui.APAGADO), 12))
                raiz.addView(Ui.comMargem(this, Ui.botao(this, p.rotulo, Ui.LARANJA) { p.resolver() }, 6))
            }
        }

        raiz.addView(Ui.comMargem(this, secaoProximos(), 24))
        raiz.addView(Ui.comMargem(this, secaoAntecedencia(), 16))
        raiz.addView(Ui.comMargem(this, secaoAgendas(), 16))
        raiz.addView(Ui.comMargem(this, Ui.botao(this, getString(R.string.testar_alarme), Ui.VERMELHO, Ui.TEXTO) { testar() }, 24))
        raiz.addView(Ui.comMargem(this, Ui.centralizado(Ui.texto(this, getString(R.string.rodape), 12f, Ui.APAGADO)).apply {
            setOnClickListener { runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.linkedin.com/in/aryribeiro"))) } }
        }, 28))

        val rolagem = ScrollView(this).apply {
            setBackgroundColor(Ui.FUNDO)
            addView(raiz)
        }
        setContentView(rolagem)
    }

    private class Pendencia(val explicacao: String, val rotulo: String, val resolver: () -> Unit)

    /** Tudo que, se faltar, impede o alarme de tocar. Cada item some sozinho quando resolvido. */
    private fun pendencias(): List<Pendencia> {
        val lista = mutableListOf<Pendencia>()
        val notificacoes = getSystemService(NotificationManager::class.java)

        if (!CalendarReader.temPermissao(this)) {
            lista += Pendencia(getString(R.string.exp_agenda), getString(R.string.btn_agenda)) {
                requestPermissions(arrayOf(Manifest.permission.READ_CALENDAR), 1)
            }
        }
        if (!notificacoes.areNotificationsEnabled()) {
            lista += Pendencia(getString(R.string.exp_notificacoes), getString(R.string.btn_notificacoes)) { pedirNotificacoes() }
        }
        if (!AlarmScheduler.podeAgendar(this) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            lista += Pendencia(getString(R.string.exp_alarme_exato), getString(R.string.btn_alarme_exato)) {
                abrirAjuste(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE && !notificacoes.canUseFullScreenIntent()) {
            lista += Pendencia(getString(R.string.exp_tela_cheia), getString(R.string.btn_tela_cheia)) {
                abrirAjuste(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
            }
        }
        if (!getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)) {
            lista += Pendencia(getString(R.string.exp_bateria), getString(R.string.btn_bateria)) {
                abrirAjuste(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            }
        }
        return lista
    }

    private fun pedirNotificacoes() {
        val podePerguntar = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED &&
            !pediuNotificacoes
        if (podePerguntar) {
            pediuNotificacoes = true
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 2)
            return
        }
        // Já perguntou (o Android não mostra a pergunta de novo após a recusa) ou Android antigo: pelos ajustes
        runCatching {
            startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
        }
    }

    private var pediuNotificacoes = false

    private fun abrirAjuste(acao: String) {
        val comPacote = Intent(acao, Uri.parse("package:$packageName"))
        // Alguns aparelhos não aceitam o atalho direto: cai na tela de detalhes do app
        runCatching { startActivity(comPacote) }.onFailure {
            runCatching { startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))) }
        }
    }

    private fun secaoProximos(): LinearLayout {
        val cartao = Ui.cartao(this)
        cartao.addView(Ui.texto(this, getString(R.string.proximos_alarmes), 15f, negrito = true))

        val agora = System.currentTimeMillis()
        val pontos = AlarmPlanner.agenda(
            CalendarReader.reunioes(this, agora), agora, Prefs.tocados(this), Prefs.dispensadas(this), Prefs.minutosAntes(this),
        )
        if (pontos.isEmpty()) {
            val vazio = if (CalendarReader.temPermissao(this)) R.string.sem_reunioes else R.string.sem_permissao_agenda
            cartao.addView(Ui.comMargem(this, Ui.texto(this, getString(vazio), 14f, Ui.APAGADO), 8))
        }
        for (p in pontos.take(8)) {
            val linha = "${RingService.hora(p.reuniao.inicio)}  ${p.reuniao.titulo}"
            cartao.addView(Ui.comMargem(this, Ui.texto(this, linha, 14f), 8))
            cartao.addView(Ui.texto(this, getString(R.string.toca_as, RingService.hora(p.quando)), 12f, Ui.APAGADO))
        }
        return cartao
    }

    private fun secaoAntecedencia(): LinearLayout {
        val cartao = Ui.cartao(this)
        cartao.addView(Ui.texto(this, getString(R.string.avisar_antes), 15f, negrito = true))
        val linha = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val atual = Prefs.minutosAntes(this)
        for (minutos in listOf(5, 10, 15)) {
            val escolhido = minutos == atual
            val botao = Ui.botao(this, getString(R.string.n_min, minutos), if (escolhido) Ui.VERDE else Ui.FUNDO, if (escolhido) android.graphics.Color.BLACK else Ui.TEXTO) {
                Prefs.definirMinutosAntes(this, minutos)
                AlarmScheduler.sincronizar(this)
                montar()
            }
            botao.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = Ui.dp(this@MainActivity, 8)
                topMargin = Ui.dp(this@MainActivity, 10)
            }
            linha.addView(botao)
        }
        cartao.addView(linha)
        return cartao
    }

    private fun secaoAgendas(): LinearLayout {
        val cartao = Ui.cartao(this)
        cartao.addView(Ui.texto(this, getString(R.string.agendas), 15f, negrito = true))
        val agendas = CalendarReader.agendas(this)
        if (agendas.isEmpty()) {
            cartao.addView(Ui.comMargem(this, Ui.texto(this, getString(R.string.sem_permissao_agenda), 14f, Ui.APAGADO), 8))
            return cartao
        }

        val ativas = CalendarReader.agendasAtivas(this)
        for (agenda in agendas) {
            val caixa = CheckBox(this).apply {
                text = if (agenda.conta.isNotEmpty() && agenda.conta != agenda.nome) "${agenda.nome}\n${agenda.conta}" else agenda.nome
                setTextColor(Ui.TEXTO)
                isChecked = agenda.id in ativas
                setOnCheckedChangeListener { _, marcada ->
                    val novo = CalendarReader.agendasAtivas(this@MainActivity).toMutableSet()
                    if (marcada) novo += agenda.id else novo -= agenda.id
                    Prefs.definirCalendarios(this@MainActivity, novo)
                    AlarmScheduler.sincronizar(this@MainActivity)
                    montar()
                }
            }
            cartao.addView(Ui.comMargem(this, caixa, 6))
        }
        return cartao
    }

    private fun testar() {
        val teste = Reuniao(eventId = -1, inicio = System.currentTimeMillis(), titulo = getString(R.string.teste_titulo), link = null)
        RingService.tocar(this, teste, Tipo.AGORA)
    }
}
