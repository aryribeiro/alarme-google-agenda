package br.com.aryribeiro.alarmeagenda

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

/**
 * Tela do app com a mesma aparência do site (cabeçalho, "Próximos eventos", cartões com anel, salas e rodapé).
 * O selo "App Android" no cabeçalho diferencia do site.
 */
class MainActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private val relogio = object : Runnable {
        override fun run() {
            montar()
            handler.postDelayed(this, 30_000)
        }
    }
    private var pediuNotificacoes = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tratarLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        tratarLink(intent)
    }

    override fun onResume() {
        super.onResume()
        RingService.criarCanal(this)
        AlarmScheduler.sincronizar(this)
        montar()
        if (Conta.conectada(this)) atualizar()
        handler.postDelayed(relogio, 30_000)
    }

    override fun onPause() {
        handler.removeCallbacks(relogio)
        super.onPause()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        montar()
    }

    private fun tratarLink(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.host != "conectado") return
        if (Conta.concluirLogin(this, uri)) {
            Toast.makeText(this, R.string.conta_conectada, Toast.LENGTH_SHORT).show()
            atualizar()
        } else {
            Toast.makeText(this, R.string.conta_falhou, Toast.LENGTH_LONG).show()
        }
        intent.data = null
    }

    private fun atualizar() {
        Atualizacao.executarEmSegundoPlano(this) { runOnUiThread { if (!isFinishing) montar() } }
    }

    private fun montar() {
        val tela = if (Conta.conectada(this)) painel() else entrada()
        setContentView(tela)
    }

    // ---------------- entrada (igual à tela de login do site) ----------------

    private fun entrada(): View {
        val coluna = Ui.coluna(this, 24).apply { gravity = Gravity.CENTER_HORIZONTAL }
        // Logo com 64 dp de altura, como na tela de login do site (sem comMargem, que trocaria a altura)
        coluna.addView(logo(64).apply { (layoutParams as LinearLayout.LayoutParams).topMargin = Ui.dp(this@MainActivity, 48) })
        coluna.addView(Ui.comMargem(this, Ui.centralizado(Ui.texto(this, getString(R.string.titulo_site), 24f, negrito = true)), 16))
        coluna.addView(Ui.comMargem(this, selo(), 10, largo = false))
        coluna.addView(Ui.comMargem(this, Ui.centralizado(Ui.texto(this, getString(R.string.slogan), 14f, Ui.APAGADO)), 28))

        val botao = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(Ui.dp(this@MainActivity, 24), Ui.dp(this@MainActivity, 16), Ui.dp(this@MainActivity, 24), Ui.dp(this@MainActivity, 16))
            background = Ui.fundoComBorda(this@MainActivity, Ui.CARTAO, Ui.BORDA, 12)
            isClickable = true
            setOnClickListener { Conta.iniciarLogin(this@MainActivity) }
            addView(ImageView(this@MainActivity).apply { setImageResource(R.drawable.ic_google) })
            addView(Ui.comMargem(this@MainActivity, Ui.texto(this@MainActivity, getString(R.string.entrar_com_google), 16f, negrito = true), 0, largo = false).apply {
                (layoutParams as LinearLayout.LayoutParams).marginStart = Ui.dp(this@MainActivity, 12)
            })
        }
        coluna.addView(Ui.comMargem(this, botao, 28))
        coluna.addView(Ui.comMargem(this, Ui.centralizado(Ui.texto(this, getString(R.string.mesma_conta), 13f, Ui.TEXTO, negrito = true)), 16))
        coluna.addView(Ui.comMargem(this, Ui.centralizado(Ui.texto(this, getString(R.string.so_leitura), 12f, Ui.APAGADO)), 8))
        coluna.addView(Ui.comMargem(this, rodape(), 48))
        return rolavel(coluna)
    }

    // ---------------- painel (igual à página principal do site) ----------------

    private fun painel(): View {
        val agora = System.currentTimeMillis()
        val coluna = Ui.coluna(this)

        pendencias().takeIf { it.isNotEmpty() }?.let { coluna.addView(faixaPendencias(it)) }
        coluna.addView(cabecalho(agora))

        val principal = Ui.coluna(this, 16)
        val dados = Prefs.dados(this)
        val lista = Formatos.deHoje(dados?.reunioes ?: emptyList(), agora)

        val titulo = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(Ui.texto(this@MainActivity, getString(R.string.proximos_eventos), 18f, negrito = true).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            addView(Ui.texto(this@MainActivity, resources.getQuantityString(R.plurals.n_eventos, lista.size, lista.size), 12f, Ui.APAGADO))
        }
        principal.addView(titulo)

        when {
            dados == null -> principal.addView(Ui.comMargem(this, vazio(getString(R.string.carregando), null), 16))
            lista.isEmpty() -> principal.addView(Ui.comMargem(this, vazio(getString(R.string.agenda_limpa), getString(R.string.sem_reunioes_hoje)), 16))
            else -> lista.take(10).forEach { principal.addView(Ui.comMargem(this, cartao(it, agora), 12)) }
        }

        principal.addView(Ui.comMargem(this, antecedencia(), 24))
        principal.addView(Ui.comMargem(this, rodape(), 32))
        principal.addView(View(this), LinearLayout.LayoutParams(1, Ui.dp(this, 64)))
        coluna.addView(principal)

        val raiz = FrameLayout(this).apply { setBackgroundColor(Ui.FUNDO) }
        raiz.addView(rolavel(coluna))
        raiz.addView(botaoSalas(dados?.salas ?: emptyList()))
        return raiz
    }

    private fun cabecalho(agora: Long): View {
        val caixa = Ui.coluna(this).apply {
            setPadding(Ui.dp(this@MainActivity, 16), Ui.dp(this@MainActivity, 12), Ui.dp(this@MainActivity, 16), Ui.dp(this@MainActivity, 12))
            background = Ui.fundoComBorda(this@MainActivity, Ui.FUNDO, Ui.BORDA, 0, soBaixo = true)
        }
        val linha1 = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(logo(28))
            addView(Ui.texto(this@MainActivity, getString(R.string.titulo_site), 14f, negrito = true).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = Ui.dp(this@MainActivity, 10) }
                maxLines = 1
            })
            addView(selo())
        }
        caixa.addView(linha1)

        val atualizado = Prefs.atualizadoEm(this)
        val minutos = if (atualizado == 0L) -1 else ((agora - atualizado) / 60_000).toInt()
        val estado = when {
            minutos < 0 -> getString(R.string.aguardando)
            minutos == 0 -> getString(R.string.sincronizado_agora)
            else -> getString(R.string.ha_min, minutos)
        }
        val linha2 = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(Ui.texto(this@MainActivity, "● ", 12f, Ui.VERDE))
            addView(Ui.texto(this@MainActivity, estado, 12f, Ui.APAGADO).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            addView(acaoTexto(getString(R.string.sync), Ui.VERDE) { atualizar() })
            addView(acaoTexto(getString(R.string.teste), Ui.VERMELHO) { testar() })
            addView(acaoTexto(getString(R.string.sair), Ui.TEXTO, negrito = true) { confirmarSaida() })
        }
        caixa.addView(Ui.comMargem(this, linha2, 8))

        Prefs.dados(this)?.conta?.takeIf { it.isNotEmpty() }?.let {
            caixa.addView(Ui.comMargem(this, Ui.texto(this, getString(R.string.conta_x, it), 11f, Ui.APAGADO), 4))
        }
        return caixa
    }

    private fun cartao(r: Reuniao, agora: Long): View {
        val minutos = Formatos.minutosAte(r, agora)
        val dispensada = r.chave in Prefs.dispensadas(this)
        val perto = !dispensada && minutos <= 10

        val linha = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(Ui.dp(this@MainActivity, 16), Ui.dp(this@MainActivity, 16), Ui.dp(this@MainActivity, 8), Ui.dp(this@MainActivity, 16))
            background = Ui.fundoComBorda(this@MainActivity, Ui.CARTAO, if (perto) Formatos.LARANJA else Ui.BORDA, 12)
            alpha = if (dispensada) 0.5f else 1f
        }
        linha.addView(RingView(this).apply {
            progresso = Formatos.progresso(minutos)
            cor = Formatos.corAnel(minutos)
            texto = if (minutos <= 0) "!" else "${minutos.toInt()}'"
        })

        val textos = Ui.coluna(this).apply {
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = Ui.dp(this@MainActivity, 12) }
        }
        textos.addView(Ui.texto(this, r.titulo, 14f, negrito = true).apply { maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END })
        textos.addView(Ui.texto(this, "${RingService.hora(r.inicio)} → ${RingService.hora(r.fim)}", 12f, Ui.APAGADO))
        textos.addView(Ui.texto(this, Formatos.contagem(minutos), 12f, Formatos.corContagem(minutos), negrito = true))
        linha.addView(textos)

        r.link?.let { link ->
            linha.addView(ImageView(this).apply {
                setImageResource(R.drawable.ic_video)
                val p = Ui.dp(this@MainActivity, 10)
                setPadding(p, p, p, p)
                background = Ui.fundoComBorda(this@MainActivity, Color.argb(26, 0, 200, 83), Color.TRANSPARENT, 8)
                contentDescription = getString(R.string.entrar_na_reuniao)
                setOnClickListener { runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) } }
            })
        }
        linha.addView(Ui.texto(this, if (dispensada) "—" else "✕", 16f, Ui.APAGADO).apply {
            val p = Ui.dp(this@MainActivity, 12)
            setPadding(p, p, p, p)
            contentDescription = getString(R.string.silenciar_evento)
            if (!dispensada) setOnClickListener {
                Prefs.dispensar(this@MainActivity, r.chave, System.currentTimeMillis())
                AlarmScheduler.sincronizar(this@MainActivity)
                montar()
            }
        })
        return linha
    }

    private fun vazio(titulo: String, texto: String?): View {
        val caixa = Ui.coluna(this, 32).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            background = Ui.fundoComBorda(this@MainActivity, Ui.CARTAO, Ui.BORDA, 12)
        }
        caixa.addView(Ui.centralizado(Ui.texto(this, titulo, 18f, Ui.VERDE, negrito = true)))
        texto?.let { caixa.addView(Ui.comMargem(this, Ui.centralizado(Ui.texto(this, it, 14f, Ui.APAGADO)), 4)) }
        return caixa
    }

    private fun antecedencia(): View {
        val linha = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        linha.addView(Ui.texto(this, getString(R.string.tocar_antes), 12f, Ui.APAGADO).apply {
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        })
        val atual = Prefs.minutosAntes(this)
        for (m in listOf(5, 10, 15)) {
            val escolhido = m == atual
            linha.addView(Ui.texto(this, getString(R.string.n_min, m), 12f, if (escolhido) Ui.FUNDO else Ui.TEXTO, negrito = escolhido).apply {
                val h = Ui.dp(this@MainActivity, 10)
                setPadding(h, Ui.dp(this@MainActivity, 6), h, Ui.dp(this@MainActivity, 6))
                background = Ui.fundoComBorda(this@MainActivity, if (escolhido) Ui.VERDE else Ui.CARTAO, Ui.BORDA, 8)
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    marginStart = Ui.dp(this@MainActivity, 6)
                }
                setOnClickListener {
                    Prefs.definirMinutosAntes(this@MainActivity, m)
                    AlarmScheduler.sincronizar(this@MainActivity)
                    montar()
                }
            })
        }
        return linha
    }

    private fun botaoSalas(salas: List<Sala>): View {
        val tamanho = Ui.dp(this, 44)
        return TextView(this).apply {
            text = "☰"
            textSize = 18f
            setTextColor(Ui.TEXTO)
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Ui.CARTAO)
                setStroke(Ui.dp(this@MainActivity, 1), Ui.BORDA)
            }
            contentDescription = getString(R.string.salas)
            layoutParams = FrameLayout.LayoutParams(tamanho, tamanho, Gravity.BOTTOM or Gravity.START).apply {
                setMargins(Ui.dp(this@MainActivity, 16), 0, 0, Ui.dp(this@MainActivity, 48))
            }
            setOnClickListener { mostrarSalas(salas) }
        }
    }

    private fun mostrarSalas(salas: List<Sala>) {
        val dialogo = AlertDialog.Builder(this).setTitle(R.string.salas)
        if (salas.isEmpty()) {
            dialogo.setMessage(R.string.nenhuma_sala)
        } else {
            dialogo.setItems(salas.map { it.nome }.toTypedArray()) { _, i ->
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(salas[i].url))) }
            }
        }
        dialogo.setNegativeButton(R.string.fechar, null).show()
    }

    // ---------------- permissões ----------------

    private class Pendencia(val rotulo: String, val resolver: () -> Unit)

    /** Tudo que, se faltar, impede o alarme de tocar. Cada item some sozinho quando resolvido. */
    private fun pendencias(): List<Pendencia> {
        val lista = mutableListOf<Pendencia>()
        val notificacoes = getSystemService(NotificationManager::class.java)

        if (!notificacoes.areNotificationsEnabled()) {
            lista += Pendencia(getString(R.string.btn_notificacoes)) { pedirNotificacoes() }
        }
        if (!AlarmScheduler.podeAgendar(this) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            lista += Pendencia(getString(R.string.btn_alarme_exato)) { abrirAjuste(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM) }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE && !notificacoes.canUseFullScreenIntent()) {
            lista += Pendencia(getString(R.string.btn_tela_cheia)) { abrirAjuste(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT) }
        }
        if (!getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)) {
            lista += Pendencia(getString(R.string.btn_bateria)) { abrirAjuste(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS) }
        }
        return lista
    }

    /** Faixa laranja no topo, no mesmo estilo da faixa "Ative o som" do site. */
    private fun faixaPendencias(lista: List<Pendencia>): View {
        val faixa = Ui.coluna(this, 12).apply { setBackgroundColor(Ui.LARANJA) }
        faixa.addView(Ui.texto(this, getString(R.string.falta_permitir), 14f, Ui.FUNDO, negrito = true))
        faixa.addView(Ui.texto(this, getString(R.string.falta_permitir_explica), 12f, Ui.FUNDO))
        for (p in lista) {
            faixa.addView(Ui.comMargem(this, Ui.botao(this, p.rotulo, Ui.FUNDO, Ui.TEXTO) { p.resolver() }, 8))
        }
        return faixa
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

    private fun abrirAjuste(acao: String) {
        val comPacote = Intent(acao, Uri.parse("package:$packageName"))
        // Alguns aparelhos não aceitam o atalho direto: cai na tela de detalhes do app
        runCatching { startActivity(comPacote) }.onFailure {
            runCatching { startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))) }
        }
    }

    // ---------------- apoio ----------------

    private fun confirmarSaida() {
        AlertDialog.Builder(this)
            .setTitle(R.string.sair_titulo)
            .setMessage(R.string.sair_texto)
            .setPositiveButton(R.string.sair) { _, _ ->
                Conta.sair(this)
                Atualizacao.agendar(this)
                montar()
            }
            .setNegativeButton(R.string.cancelar, null)
            .show()
    }

    private fun testar() {
        val teste = Reuniao(id = "teste", inicio = System.currentTimeMillis(), titulo = getString(R.string.teste_titulo), link = null)
        RingService.tocar(this, teste, Tipo.AGORA)
    }

    private fun logo(alturaDp: Int): ImageView = ImageView(this).apply {
        setImageResource(R.drawable.logo)
        adjustViewBounds = true
        contentDescription = "Logo"
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, Ui.dp(this@MainActivity, alturaDp))
    }

    /** O detalhe que diferencia o app do site. */
    private fun selo(): TextView = Ui.texto(this, getString(R.string.selo_app), 11f, Ui.VERDE, negrito = true).apply {
        val h = Ui.dp(this@MainActivity, 8)
        setPadding(h, Ui.dp(this@MainActivity, 3), h, Ui.dp(this@MainActivity, 3))
        background = Ui.fundoComBorda(this@MainActivity, Color.TRANSPARENT, Ui.VERDE, 999)
    }

    private fun acaoTexto(rotulo: String, cor: Int, negrito: Boolean = false, aoTocar: () -> Unit): TextView =
        Ui.texto(this, rotulo, 13f, cor, negrito).apply {
            val p = Ui.dp(this@MainActivity, 8)
            setPadding(p, p, p, p)
            setOnClickListener { aoTocar() }
        }

    private fun rodape(): View = Ui.centralizado(Ui.texto(this, getString(R.string.rodape), 11f, Ui.APAGADO).apply {
        setTypeface(typeface, Typeface.BOLD_ITALIC)
        alpha = 0.6f
        setOnClickListener { runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.linkedin.com/in/aryribeiro"))) } }
    })

    private fun rolavel(conteudo: View): ScrollView = ScrollView(this).apply {
        setBackgroundColor(Ui.FUNDO)
        isFillViewport = true
        fitsSystemWindows = true
        addView(conteudo)
    }
}
