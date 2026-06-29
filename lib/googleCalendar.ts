import { google } from 'googleapis'
import type { CalendarEvent, Room } from '@/types'

function extractExternalLink(description?: string | null, location?: string | null): string | undefined {
  const text = [description, location].filter(Boolean).join(' ')
  if (!text) return undefined

  const urlRegex = /https?:\/\/[^\s<>"',)]+/gi
  const matches = text.match(urlRegex)
  if (!matches) return undefined

  const meetingPatterns = [
    'zoom.us', 'teams.microsoft.com', 'webex.com', 'chime.aws',
    'bluejeans.com', 'gotomeeting.com', 'joinvirtualevent',
    'whereby.com', 'around.co', 'meet.jit.si',
  ]

  const meetingLink = matches.find((url) =>
    meetingPatterns.some((pattern) => url.toLowerCase().includes(pattern))
  )

  return meetingLink || matches[0]
}

/**
 * Busca todos os eventos do dia no Google Calendar.
 * Inclui eventos novos, editados, tentative e aceitos.
 * Não usa cache — sempre busca fresh da API para capturar edições.
 */
export async function fetchUpcomingEvents(accessToken: string): Promise<CalendarEvent[]> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const calendar = google.calendar({ version: 'v3', auth })

  const now = new Date()
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  const allEvents: CalendarEvent[] = []
  let pageToken: string | undefined

  do {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      showDeleted: false,
      ...(pageToken ? { pageToken } : {}),
    })

    const items = response.data.items || []

    for (const event of items) {
      if (!event.start?.dateTime) continue
      if (event.status === 'cancelled') continue

      allEvents.push({
        id: event.id || crypto.randomUUID(),
        summary: event.summary || '(Sem título)',
        description: event.description || undefined,
        start: event.start.dateTime,
        end: event.end?.dateTime || event.start.dateTime,
        hangoutLink: event.hangoutLink || undefined,
        externalLink: !event.hangoutLink
          ? extractExternalLink(event.description, event.location)
          : undefined,
        calendarColor: event.colorId || undefined,
        calendarName: undefined,
      })
    }

    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)

  return allEvents
}

/**
 * Busca eventos all-day que contenham "SALA INTERNA" no nome e possuam hangoutLink.
 * Esses são as salas de reunião permanentes da organização.
 */
export async function fetchRooms(accessToken: string): Promise<Room[]> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const calendar = google.calendar({ version: 'v3', auth })

  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    maxResults: 50,
    showDeleted: false,
  })

  const items = response.data.items || []
  const rooms: Room[] = []

  for (const event of items) {
    if (event.status === 'cancelled') continue
    if (!event.summary) continue

    const isSala = event.summary.toUpperCase().includes('SALA INTERNA')
    if (!isSala) continue

    const url = event.hangoutLink
      || extractExternalLink(event.description, event.location)
    if (!url) continue

    rooms.push({
      name: event.summary,
      url,
    })
  }

  rooms.sort((a, b) => a.name.localeCompare(b.name))
  return rooms
}
