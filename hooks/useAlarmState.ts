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
  isPlaying: boolean
  testAlarm: () => void
  dismissTest: () => void
  isTestActive: boolean
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
  isPlaying: false,
  testAlarm: () => {},
  dismissTest: () => {},
  isTestActive: false,
})

export function useAlarmState() {
  return useContext(AlarmContext)
}
