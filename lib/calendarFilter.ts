// Decide se um item da Calendar API v3 merece alarme. Usado pelo app e pelo vigia de push:
// a decisão mora só aqui.

export interface RawCalendarItem {
  id?: string | null
  status?: string | null
  eventType?: string | null
  start?: { dateTime?: string | null; date?: string | null } | null
  attendees?: Array<{ self?: boolean | null; responseStatus?: string | null }> | null
}

// events.list devolve todos os tipos por padrão; estes dois marcam ausência, não reunião
const NOT_MEETINGS = ['outOfOffice', 'workingLocation']

export function isAlarmableEvent(item: RawCalendarItem): boolean {
  if (!item.start?.dateTime) return false
  if (item.status === 'cancelled') return false
  if (item.eventType && NOT_MEETINGS.includes(item.eventType)) return false
  const me = item.attendees?.find((a) => a.self)
  return me?.responseStatus !== 'declined'
}
