package br.com.aryribeiro.alarmeagenda

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** Blocos de tela montados em código: mesmas cores do web app, sem biblioteca de interface. */
object Ui {
    val FUNDO = Color.parseColor("#0A0A0F")
    val CARTAO = Color.parseColor("#13131A")
    val TEXTO = Color.parseColor("#F5F5F5")
    val APAGADO = Color.parseColor("#9E9E9E")
    val VERMELHO = Color.parseColor("#E53935")
    val VERMELHO_ESCURO = Color.parseColor("#7F1D1D")
    val VERDE = Color.parseColor("#00C853")
    val LARANJA = Color.parseColor("#F57C00")
    val BORDA = Color.parseColor("#2A2A3A")

    /** Fundo arredondado com contorno de 1 dp (o "rounded-xl border" do site). */
    fun fundoComBorda(c: Context, fundo: Int, borda: Int, raioDp: Int, soBaixo: Boolean = false): android.graphics.drawable.Drawable {
        val forma = GradientDrawable().apply {
            setColor(fundo)
            cornerRadius = dp(c, raioDp).toFloat()
            if (!soBaixo) setStroke(dp(c, 1), borda)
        }
        if (!soBaixo) return forma
        // Só a linha de baixo, como o border-b do cabeçalho do site
        val linha = GradientDrawable().apply { setColor(borda) }
        return android.graphics.drawable.LayerDrawable(arrayOf(linha, forma)).apply { setLayerInset(1, 0, 0, 0, dp(c, 1)) }
    }

    fun dp(c: Context, valor: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, valor.toFloat(), c.resources.displayMetrics).toInt()

    fun coluna(c: Context, espaco: Int = 0): LinearLayout = LinearLayout(c).apply {
        orientation = LinearLayout.VERTICAL
        if (espaco > 0) setPadding(dp(c, espaco), dp(c, espaco), dp(c, espaco), dp(c, espaco))
    }

    fun texto(c: Context, conteudo: CharSequence, tamanhoSp: Float = 15f, cor: Int = TEXTO, negrito: Boolean = false): TextView =
        TextView(c).apply {
            text = conteudo
            setTextSize(TypedValue.COMPLEX_UNIT_SP, tamanhoSp)
            setTextColor(cor)
            if (negrito) setTypeface(typeface, Typeface.BOLD)
        }

    fun botao(c: Context, rotulo: CharSequence, fundo: Int, corTexto: Int = Color.BLACK, aoTocar: (View) -> Unit): Button =
        Button(c).apply {
            text = rotulo
            isAllCaps = false
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(corTexto)
            setTypeface(typeface, Typeface.BOLD)
            background = GradientDrawable().apply {
                setColor(fundo)
                cornerRadius = dp(c, 12).toFloat()
            }
            minHeight = dp(c, 52)
            setOnClickListener(aoTocar)
        }

    fun comMargem(c: Context, view: View, topo: Int = 0, largo: Boolean = true): View {
        view.layoutParams = LinearLayout.LayoutParams(
            if (largo) LinearLayout.LayoutParams.MATCH_PARENT else LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = dp(c, topo) }
        return view
    }

    fun cartao(c: Context): LinearLayout = coluna(c, 14).apply {
        background = GradientDrawable().apply {
            setColor(CARTAO)
            cornerRadius = dp(c, 12).toFloat()
        }
    }

    fun centralizado(view: TextView): TextView = view.apply { gravity = Gravity.CENTER_HORIZONTAL }
}
