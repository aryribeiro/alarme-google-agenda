'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalendarEvent, AlarmLevel } from '@/types'
import { calculateAlarmLevel, getMinutesUntilEvent, isEventSilencedToday, silenceEvent as silenceEventInStorage } from '@/lib/alarmLogic'
import { getAdminConfig } from '@/lib/adminAuth'
import type { ActiveAlarm } from './useAlarmState'

interface PollingState {
  events: CalendarEvent[]
  activeAlarms: ActiveAlarm[]
  lastSync: Date | null
  isLoading: boolean
  error: string | null
}

export function useCalendarPolling() {
  const [state, setState] = useState<PollingState>({
    events: [],
    activeAlarms: [],
    lastSync: null,
    isLoading: false,
    error: null,
  })

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const snoozedRef = useRef<Map<string, number>>(new Map())

  const fetchEvents = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const res = await fetch('/api/calendar/events')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha ao buscar eventos')
      }

      const allEvents: CalendarEvent[] = await res.json()
      const config = getAdminConfig()
      const now = Date.now()
      const events = allEvents.filter((e) => {
        const end = new Date(e.end).getTime()
        return end > now - 30 * 60 * 1000
      })

      setState((prev) => ({
        ...prev,
        events: events.slice(0, config.maxEvents),
        lastSync: new Date(),
        isLoading: false,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      }))
    }
  }, [])

  const calculateAlarms = useCallback(() => {
    setState((prev) => {
      const config = getAdminConfig()
      const alarms: ActiveAlarm[] = []

      for (const event of prev.events) {
        if (isEventSilencedToday(event.id)) continue

        const snoozedUntil = snoozedRef.current.get(event.id)
        if (snoozedUntil && Date.now() < snoozedUntil) continue

        const minutes = getMinutesUntilEvent(event)
        if (minutes < -30) continue

        const level = calculateAlarmLevel(minutes, config)
        if (level) {
          alarms.push({ event, level })
        }
      }

      alarms.sort((a, b) => {
        const order: Record<AlarmLevel, number> = { maximum: 0, critical: 1, urgent: 2, warning: 3 }
        return order[a.level] - order[b.level]
      })

      return { ...prev, activeAlarms: alarms }
    })
  }, [])

  const silenceEvent = useCallback((eventId: string) => {
    silenceEventInStorage(eventId)
    calculateAlarms()
  }, [calculateAlarms])

  const snoozeEvent = useCallback((eventId: string) => {
    snoozedRef.current.set(eventId, Date.now() + 2 * 60 * 1000)
    calculateAlarms()
  }, [calculateAlarms])

  const syncNow = useCallback(() => {
    fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    fetchEvents()

    const config = getAdminConfig()
    pollingRef.current = setInterval(fetchEvents, config.pollingInterval * 60 * 1000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchEvents])

  useEffect(() => {
    calculateAlarms()
    countdownRef.current = setInterval(calculateAlarms, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [calculateAlarms, state.events])

  return {
    ...state,
    silenceEvent,
    snoozeEvent,
    syncNow,
  }
}
