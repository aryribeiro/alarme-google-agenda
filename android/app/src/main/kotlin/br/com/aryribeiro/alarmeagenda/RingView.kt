package br.com.aryribeiro.alarmeagenda

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.view.View

/** Anel de contagem do cartão de evento, igual ao SVG do site (48 px, traço 3 px, começa no topo). */
class RingView(context: Context) : View(context) {
    var progresso = 0f
    var cor = Formatos.CINZA
    var texto = ""

    private val fundo = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = Color.parseColor("#2A2A3A") }
    private val arco = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val letra = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#F5F5F5")
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT_BOLD
    }
    private val caixa = RectF()

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val lado = Ui.dp(context, 48)
        setMeasuredDimension(lado, lado)
    }

    override fun onDraw(canvas: Canvas) {
        val traco = Ui.dp(context, 3).toFloat()
        fundo.strokeWidth = traco
        arco.strokeWidth = traco
        arco.color = cor
        val raio = width * 20f / 48f
        caixa.set(width / 2f - raio, height / 2f - raio, width / 2f + raio, height / 2f + raio)
        canvas.drawOval(caixa, fundo)
        if (progresso > 0f) canvas.drawArc(caixa, -90f, 360f * progresso, false, arco)
        letra.textSize = Ui.dp(context, 10).toFloat()
        canvas.drawText(texto, width / 2f, height / 2f - (letra.descent() + letra.ascent()) / 2, letra)
    }
}
