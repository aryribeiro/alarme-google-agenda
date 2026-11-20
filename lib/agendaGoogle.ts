// Busca no Google (OAuth + Calendar API v3) das reuniões que o app Android recebe. Só servidor.
// fetch injetável para teste.
import { isAlarmableEvent, type RawCalendarItem } from './calendarFilter'
import { extractExternalLink } from './meetingLink'

type FetchFn = typeof fetch

const CALENDAR = 'https://www.googleapis.com/calendar/v3'
const HOUR = 60 * 60 * 1000
const LOOKAHEAD_MS = 24 * HOUR
const LOOKBEHIND_MS = 15 * 60 * 1000

/** O Google recusou o refresh token de vez (revogado ou vencido): só um novo login resolve. */
export class InvalidGrantError extends Error {
  constructor() {
    super('invalid_grant')
    this.name = 'InvalidGrantError'
  }
}

export async function refreshAccessToken(
  refreshToken: string,
  env: { clientId: string; clientSecret: string },
  fetchFn: FetchFn = fetch
): Promise<string> {
  const response = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  const data = (await response.json()) as { access_token?: string; error?: string }

  if (data.error === 'invalid_grant') throw new InvalidGrantError()
  if (!response.ok || !data.access_token) throw new Error(`oauth ${response.status}`)
  return data.access_token
}

interface RawListItem extends RawCalendarItem {
  id?: string | null
  summary?: string | null
  hangoutLink?: string | null
  description?: string | null
  location?: string | null
  end?: { dateTime?: string | null } | null
}

/** Reunião como o app Android recebe: horários em milissegundos e o link já escolhido. */
export interface AppEvent {
  id: string
  titulo: string
  inicio: number
  fim: number
  link: string | null
}

/** Reuniões com alarme nas próximas 24 h (e as que começaram há pouco), no formato do app. */
export async function listAppEvents(accessToken: string, now: number, fetchFn: FetchFn = fetch): Promise<AppEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date(now - LOOKBEHIND_MS).toISOString(),
    timeMax: new Date(now + LOOKAHEAD_MS).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
    fields: 'items(id,summary,status,eventType,start,end,hangoutLink,description,location,attendees(self,responseStatus))',
  })
  const response = await fetchFn(`${CALENDAR}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`calendar ${response.status}`)

  const data = (await response.json()) as { items?: RawListItem[] }
  return (data.items || [])
    .filter((item) => item.id && isAlarmableEvent(item))
    .map((item) => {
      const inicio = Date.parse(item.start?.dateTime as string)
      return {
        id: item.id as string,
        titulo: item.summary || '(Sem título)',
        inicio,
        fim: item.end?.dateTime ? Date.parse(item.end.dateTime) : inicio,
        // Mesma escolha do site: Meet primeiro, senão o link de reunião escrito no evento
        link: item.hangoutLink || extractExternalLink(item.description, item.location) || null,
      }
    })
}
