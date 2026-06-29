import type { AlarmLevel, AdminConfig, CalendarEvent } from '@/types'
import { DEFAULT_CONFIG } from '@/types'

/**
 * Calcula o nível de alarme com base nos minutos restantes até o evento.
 * Retorna null se o evento está fora de qualquer faixa de alerta.
 */
export function calculateAlarmLevel(
  minutesUntilEvent: number,
  config: AdminConfig = DEFAULT_CONFIG
): AlarmLevel | null {
  if (minutesUntilEvent <= 0) return 'maximum'
  if (minutesUntilEvent <= config.criticalMinutes) return 'critical'
  if (minutesUntilEvent <= config.urgentMinutes) return 'urgent'
  if (minutesUntilEvent <= config.warningMinutes) return 'warning'
  return null
}

/**
 * Calcula minutos restantes até o início do evento.
 */
export function getMinutesUntilEvent(event: CalendarEvent): number {
  const startTime = new Date(event.start).getTime()
  const now = Date.now()
  return (startTime - now) / (1000 * 60)
}

/**
 * Retorna o volume apropriado para o nível de alarme.
 * O volume base do admin config é aplicado como multiplicador.
 */
export function getVolumeForLevel(level: AlarmLevel, config: AdminConfig = DEFAULT_CONFIG): number {
  const baseMultiplier = config.volume / 100

  switch (level) {
    case 'warning':
      return 0
    case 'urgent':
      return 0.5 * baseMultiplier
    case 'critical':
      return 0.8 * baseMultiplier
    case 'maximum':
      return 1.0 * baseMultiplier
  }
}

/**
 * Verifica se um evento foi silenciado hoje.
 */
export function isEventSilencedToday(eventId: string): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem('alarme-silenced-events')
  if (!stored) return false

  try {
    const data = JSON.parse(stored) as { date: string; events: string[] }
    const today = new Date().toISOString().split('T')[0]
    if (data.date !== today) {
      localStorage.removeItem('alarme-silenced-events')
      return false
    }
    return data.events.includes(eventId)
  } catch {
    return false
  }
}

/**
 * Marca um evento como silenciado para hoje.
 */
export function silenceEvent(eventId: string): void {
  if (typeof window === 'undefined') return
  const today = new Date().toISOString().split('T')[0]
  const stored = localStorage.getItem('alarme-silenced-events')

  let data: { date: string; events: string[] } = { date: today, events: [] }

  if (stored) {
    try {
      data = JSON.parse(stored)
      if (data.date !== today) {
        data = { date: today, events: [] }
      }
    } catch {
      data = { date: today, events: [] }
    }
  }

  if (!data.events.includes(eventId)) {
    data.events.push(eventId)
  }

  localStorage.setItem('alarme-silenced-events', JSON.stringify(data))
}
