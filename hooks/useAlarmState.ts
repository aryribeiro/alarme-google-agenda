'use client'

import { createContext, useContext } from 'react'
import type { AlarmLevel, CalendarEvent } from '@/types'

export interface ActiveAlarm {
  event: CalendarEvent
  level: AlarmLevel
}

export interface AlarmContextType {
  events: CalendarEvent[]
  activeAlarms: ActiveAlarm[]
  lastSync: Date | null
  isLoading: boolean
  error: string | null
  syncNow: () => void
  silenceEvent: (eventId: string) => void
  snoozeEvent: (eventId: string) => void
  isAudioUnlocked: boolean
  unlockAudio: () => Promise<void>
  playAlarm: (level: AlarmLevel) => void
  stopAlarm: () => void
  testAlarm: () => void
  dismissTest: () => void
  isTestActive: boolean
  disablePush: () => Promise<void>
}

export const AlarmContext = createContext<AlarmContextType>({
  events: [],
  activeAlarms: [],
  lastSync: null,
  isLoading: false,
  error: null,
  syncNow: () => {},
  silenceEvent: () => {},
  snoozeEvent: () => {},
  isAudioUnlocked: false,
  unlockAudio: async () => {},
  playAlarm: () => {},
  stopAlarm: () => {},
  testAlarm: () => {},
  dismissTest: () => {},
  isTestActive: false,
  disablePush: async () => {},
})

export function useAlarmState() {
  return useContext(AlarmContext)
}
