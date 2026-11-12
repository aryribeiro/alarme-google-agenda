// Borda de rede do vigia com o Google (OAuth + Calendar API v3). Só servidor.
// fetch injetável para teste; nada aqui decide alarme (isso é do pushPlan).
import { isAlarmableEvent, type RawCalendarItem } from './calendarFilter'
import type { PlanEvent } from './pushPlan'

type FetchFn = typeof fetch

const CALENDAR = 'https://www.googleapis.com/calendar/v3'
const HOUR = 60 * 60 * 1000
const LOOKAHEAD_MS = 24 * HOUR
const LOOKBEHIND_MS = 15 * 60 * 1000
// Renova com folga: sem canal, mudança na agenda só é vista no ressincronismo
const CHANNEL_RENEW_BEFORE_MS = 12 * HOUR
const CHANNEL_TTL_SECONDS = 7 * 24 * 60 * 60

export interface WatchChannel {
  id: string
  resourceId: string
  expiration: number
}

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
  summary?: string | null
  hangoutLink?: string | null
}

export async function listUpcomingEvents(accessToken: string, now: number, fetchFn: FetchFn = fetch): Promise<PlanEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date(now - LOOKBEHIND_MS).toISOString(),
    timeMax: new Date(now + LOOKAHEAD_MS).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
    fields: 'items(id,summary,status,eventType,start,hangoutLink,attendees(self,responseStatus))',
  })
  const response = await fetchFn(`${CALENDAR}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`calendar ${response.status}`)

  const data = (await response.json()) as { items?: RawListItem[] }
  return (data.items || [])
    .filter((item) => item.id && isAlarmableEvent(item))
    .map((item) => ({
      id: item.id as string,
      summary: item.summary || '(Sem título)',
      start: item.start?.dateTime as string,
      hangoutLink: item.hangoutLink || undefined,
    }))
}

function channelIsFresh(channel: WatchChannel | null, now: number): channel is WatchChannel {
  return channel !== null && channel.expiration - now > CHANNEL_RENEW_BEFORE_MS
}

async function stopChannel(accessToken: string, channel: WatchChannel, fetchFn: FetchFn): Promise<void> {
  // Melhor esforço: canal velho expira sozinho
  await fetchFn(`${CALENDAR}/channels/stop`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: channel.id, resourceId: channel.resourceId }),
  }).catch(() => undefined)
}

/**
 * Mantém um canal de aviso de mudança (events.watch) apontando para o webhook.
 * A API exige HTTPS; em desenvolvimento local não há canal.
 */
export async function ensureWatchChannel(
  input: { accessToken: string; channel: WatchChannel | null; address: string; token: string; now: number; channelId: string },
  fetchFn: FetchFn = fetch
): Promise<WatchChannel | null> {
  if (channelIsFresh(input.channel, input.now)) return input.channel
  if (!input.address.startsWith('https://')) return null

  const response = await fetchFn(`${CALENDAR}/calendars/primary/events/watch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: input.channelId,
      type: 'web_hook',
      address: input.address,
      token: input.token,
      params: { ttl: String(CHANNEL_TTL_SECONDS) },
    }),
  })
  // Sem canal novo, fica com o que tinha (pode ainda valer algumas horas)
  if (!response.ok) return input.channel

  const data = (await response.json()) as { id: string; resourceId: string; expiration: string }
  if (input.channel) await stopChannel(input.accessToken, input.channel, fetchFn)
  return { id: data.id, resourceId: data.resourceId, expiration: Number(data.expiration) }
}
