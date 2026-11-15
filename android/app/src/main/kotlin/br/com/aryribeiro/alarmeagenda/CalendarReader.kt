package br.com.aryribeiro.alarmeagenda

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract.Attendees
import android.provider.CalendarContract.Calendars
import android.provider.CalendarContract.Events
import android.provider.CalendarContract.Instances

data class Agenda(val id: String, val nome: String, val conta: String, val principal: Boolean)

/**
 * Lê a agenda que o próprio Android mantém sincronizada (a mesma que o app Google Agenda mostra).
 * Sem servidor e sem login: basta a permissão de leitura.
 */
object CalendarReader {
    private const val DIA = 24 * 60 * 60_000L

    fun temPermissao(c: Context): Boolean =
        c.checkSelfPermission(Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED

    fun agendas(c: Context): List<Agenda> {
        if (!temPermissao(c)) return emptyList()
        val colunas = arrayOf(Calendars._ID, Calendars.CALENDAR_DISPLAY_NAME, Calendars.ACCOUNT_NAME, Calendars.OWNER_ACCOUNT, Calendars.IS_PRIMARY)
        val lista = mutableListOf<Agenda>()
        c.contentResolver.query(Calendars.CONTENT_URI, colunas, null, null, null)?.use { cur ->
            while (cur.moveToNext()) {
                val conta = cur.getString(2) ?: ""
                val dono = cur.getString(3) ?: ""
                // IS_PRIMARY nem sempre vem preenchido; agenda cujo dono é a própria conta é a principal
                val principal = cur.getInt(4) == 1 || (conta.isNotEmpty() && conta == dono)
                lista += Agenda(cur.getLong(0).toString(), cur.getString(1) ?: conta, conta, principal)
            }
        }
        return lista
    }

    /** Agendas que valem para alarme: as escolhidas na tela ou, sem escolha, as principais. */
    fun agendasAtivas(c: Context): Set<String> =
        Prefs.calendarios(c) ?: agendas(c).filter { it.principal }.map { it.id }.toSet()

    /** Reuniões com horário marcado nas próximas 24 h (e as que começaram há pouco). */
    fun reunioes(c: Context, agora: Long): List<Reuniao> {
        if (!temPermissao(c)) return emptyList()
        val ativas = agendasAtivas(c)
        if (ativas.isEmpty()) return emptyList()

        val uri = Instances.CONTENT_URI.buildUpon().let {
            ContentUris.appendId(it, agora - AlarmPlanner.ATRASO_MAX)
            ContentUris.appendId(it, agora + DIA)
            it.build()
        }
        val colunas = arrayOf(
            Instances.EVENT_ID, Instances.BEGIN, Instances.TITLE, Instances.ALL_DAY, Instances.CALENDAR_ID,
            Instances.STATUS, Instances.SELF_ATTENDEE_STATUS, Instances.DESCRIPTION, Instances.EVENT_LOCATION,
        )

        val lista = mutableListOf<Reuniao>()
        c.contentResolver.query(uri, colunas, null, null, "${Instances.BEGIN} ASC")?.use { cur ->
            while (cur.moveToNext()) {
                val diaInteiro = cur.getInt(3) == 1
                val cancelada = cur.getInt(5) == Events.STATUS_CANCELED
                val recusada = cur.getInt(6) == Attendees.ATTENDEE_STATUS_DECLINED
                if (diaInteiro || cancelada || recusada || cur.getLong(4).toString() !in ativas) continue

                lista += Reuniao(
                    eventId = cur.getLong(0),
                    inicio = cur.getLong(1),
                    titulo = cur.getString(2)?.takeIf { it.isNotBlank() } ?: "(Sem título)",
                    link = MeetingLink.extrair(cur.getString(7), cur.getString(8)),
                )
            }
        }
        return lista
    }
}
