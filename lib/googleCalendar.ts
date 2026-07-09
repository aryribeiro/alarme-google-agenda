import { google } from 'googleapis'
import type { CalendarEvent, Room, SyncResult } from '@/types'
import { parseGoogleError, withRetry } from './googleErrors'

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

function toCalendarEvent(event: { id?: string | null; summary?: string | null; description?: string | null; start?: { dateTime?: string | null } | null; end?: { dateTime?: string | null } | null; hangoutLink?: string | null; location?: string | null }): CalendarEvent | null {
  if (!event.start?.dateTime) return null
  return {
    id: event.id || crypto.randomUUID(),
    summary: event.summary || '(Sem título)',
    description: event.description || undefined,
    start: event.start.dateTime,
    end: event.end?.dateTime || event.start.dateTime,
    hangoutLink: event.hangoutLink || undefined,
    externalLink: !event.hangoutLink
      ? extractExternalLink(event.description, event.location)
      : undefined,
  }
}

export async function fetchUpcomingEvents(
  accessToken: string,
  syncToken?: string
): Promise<SyncResult> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const calendar = google.calendar({ version: 'v3', auth })

  if (syncToken) {
    try {
      return await withRetry(async () => {
        const events: CalendarEvent[] = []
        const cancelledIds: string[] = []
        let pageToken: string | undefined
        let nextSyncToken: string | null = null

        do {
          const response = await calendar.events.list({
            calendarId: 'primary',
            syncToken,
            singleEvents: true,
            showDeleted: true,
            ...(pageToken ? { pageToken } : {}),
          })

          for (const item of response.data.items || []) {
            if (item.status === 'cancelled') {
              if (item.id) cancelledIds.push(item.id)
              continue
            }
            const ev = toCalendarEvent(item)
            if (ev) events.push(ev)
          }

          nextSyncToken = response.data.nextSyncToken || null
          pageToken = response.data.nextPageToken || undefined
        } while (pageToken)

        return { events, cancelledIds, nextSyncToken, incremental: true }
      })
    } catch (error) {
      if (parseGoogleError(error).code === 'SYNC_TOKEN_EXPIRED') {
        return fetchUpcomingEvents(accessToken)
      }
      throw error
    }
  }

  return withRetry(async () => {
    const now = new Date()
    const brtDate = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const endOfDay = new Date(Date.UTC(
      brtDate.getUTCFullYear(),
      brtDate.getUTCMonth(),
      brtDate.getUTCDate(),
      26, 59, 59, 999
    ))

    const events: CalendarEvent[] = []
    let pageToken: string | undefined
    let nextSyncToken: string | null = null

    do {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
        showDeleted: false,
        ...(pageToken ? { pageToken } : {}),
      })

      for (const item of response.data.items || []) {
        if (!item.start?.dateTime) continue
        if (item.status === 'cancelled') continue
        const ev = toCalendarEvent(item)
        if (ev) events.push(ev)
      }

      nextSyncToken = response.data.nextSyncToken || null
      pageToken = response.data.nextPageToken || undefined
    } while (pageToken)

    return { events, cancelledIds: [], nextSyncToken, incremental: false }
  })
}

export async function fetchRooms(accessToken: string): Promise<Room[]> {
  return withRetry(async () => {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const calendar = google.calendar({ version: 'v3', auth })

    const now = new Date()
    const brtDate = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const startOfDay = new Date(Date.UTC(
      brtDate.getUTCFullYear(),
      brtDate.getUTCMonth(),
      brtDate.getUTCDate(),
      3, 0, 0, 0
    ))
    const endOfDay = new Date(Date.UTC(
      brtDate.getUTCFullYear(),
      brtDate.getUTCMonth(),
      brtDate.getUTCDate(),
      26, 59, 59, 999
    ))

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

      rooms.push({ name: event.summary, url })
    }

    const unique = new Map<string, Room>()
    rooms.forEach((room) => {
      if (!unique.has(room.name)) unique.set(room.name, room)
    })

    const result: Room[] = []
    unique.forEach((room) => result.push(room))
    result.sort((a, b) => a.name.localeCompare(b.name))
    return result
  })
}

export async function watchCalendar(
  accessToken: string,
  webhookUrl: string,
  userToken: string
): Promise<{ channelId: string; resourceId: string; expiration: string }> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const calendar = google.calendar({ version: 'v3', auth })

  const response = await calendar.events.watch({
    calendarId: 'primary',
    requestBody: {
      id: crypto.randomUUID(),
      type: 'web_hook',
      address: webhookUrl,
      token: userToken,
      params: { ttl: '86400' },
    },
  })

  return {
    channelId: response.data.id!,
    resourceId: response.data.resourceId!,
    expiration: response.data.expiration!,
  }
}

export async function stopWatchChannel(
  accessToken: string,
  channelId: string,
  resourceId: string
): Promise<void> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const calendar = google.calendar({ version: 'v3', auth })

  await calendar.channels.stop({
    requestBody: { id: channelId, resourceId },
  })
}
