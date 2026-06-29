export type AlarmLevel = 'warning' | 'urgent' | 'critical' | 'maximum'

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: string
  end: string
  hangoutLink?: string
  externalLink?: string
  calendarColor?: string
  calendarName?: string
}

export interface Room {
  name: string
  url: string
}

export interface AlarmState {
  activeAlarms: Map<string, AlarmLevel>
  silencedEvents: Set<string>
  snoozedEvents: Map<string, number>
}

export interface AdminConfig {
  pollingInterval: number
  warningMinutes: number
  urgentMinutes: number
  criticalMinutes: number
  volume: number
  fallbackFrequency: number
  vibrationEnabled: boolean
  ignoreBusy: boolean
  maxEvents: number
  adminPasswordHash: string
}

export const DEFAULT_CONFIG: AdminConfig = {
  pollingInterval: 2,
  warningMinutes: 30,
  urgentMinutes: 10,
  criticalMinutes: 5,
  volume: 100,
  fallbackFrequency: 880,
  vibrationEnabled: true,
  ignoreBusy: false,
  maxEvents: 10,
  adminPasswordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // admin123
}
