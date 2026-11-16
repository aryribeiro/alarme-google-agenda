package br.com.aryribeiro.alarmeagenda

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class Sala(val nome: String, val url: String)

/** tokenNovo: credencial renovada pelo servidor (vem no máximo uma vez por dia). */
data class Dados(val conta: String, val reunioes: List<Reuniao>, val salas: List<Sala>, val tokenNovo: String? = null)

/** Conversa com o mesmo servidor do site: as reuniões vêm da conta Google da empresa, não do celular. */
object Api {
    const val SERVIDOR = "https://in2clouds.vercel.app"

    /** Endereço em uso. Só os testes trocam (para nunca chamar a produção). */
    @Volatile
    var servidor = SERVIDOR

    sealed class Resultado {
        data class Ok(val json: String) : Resultado()
        /** A credencial não vale mais (saiu da conta ou o Google revogou): precisa entrar de novo. */
        object Reconectar : Resultado()
        data class Falha(val motivo: String) : Resultado()
    }

    fun buscar(token: String, verificador: String): Resultado {
        val conexao = (URL("$servidor/api/app/eventos").openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 20_000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("X-Verificador", verificador)
            setRequestProperty("Accept", "application/json")
        }
        return try {
            when (val status = conexao.responseCode) {
                200 -> Resultado.Ok(conexao.inputStream.bufferedReader().use { it.readText() })
                401 -> Resultado.Reconectar
                else -> Resultado.Falha("HTTP $status")
            }
        } catch (erro: Exception) {
            Resultado.Falha(erro.javaClass.simpleName)
        } finally {
            conexao.disconnect()
        }
    }

    fun ler(json: String): Dados {
        val raiz = JSONObject(json)
        val eventos = raiz.optJSONArray("eventos") ?: JSONArray()
        val reunioes = (0 until eventos.length()).mapNotNull { i ->
            val e = eventos.optJSONObject(i) ?: return@mapNotNull null
            val id = e.optString("id").takeIf { it.isNotEmpty() } ?: return@mapNotNull null
            if (!e.has("inicio")) return@mapNotNull null
            val inicio = e.getLong("inicio")
            Reuniao(
                id = id,
                inicio = inicio,
                titulo = e.optString("titulo").takeIf { it.isNotBlank() } ?: "(Sem título)",
                link = if (e.isNull("link")) null else e.optString("link").takeIf { it.isNotBlank() },
                fim = e.optLong("fim", inicio),
            )
        }
        val listaSalas = raiz.optJSONArray("salas") ?: JSONArray()
        val salas = (0 until listaSalas.length()).mapNotNull { i ->
            val s = listaSalas.optJSONObject(i) ?: return@mapNotNull null
            val url = s.optString("url").takeIf { it.isNotBlank() } ?: return@mapNotNull null
            Sala(s.optString("nome"), url)
        }
        return Dados(raiz.optString("conta"), reunioes, salas, raiz.optString("token").takeIf { it.isNotEmpty() })
    }
}
