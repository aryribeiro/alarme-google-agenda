'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalendarEvent, AlarmLevel, SyncResult } from '@/types'
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

function getBrtDateString(now: number): string {
  const brt = new Date(now - 3 * 60 * 60 * 1000)
  return brt.toISOString().split('T')[0]
}

function isEventToday(event: CalendarEvent, todayBrt: string): boolean {
  const startMs = new Date(event.start).getTime()
  const eventDateBrt = getBrtDateString(startMs)
  return eventDateBrt === todayBrt
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
  const webhookRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const snoozedRef = useRef<Map<string, number>>(new Map())
  const syncTokenRef = useRef<string | null>(null)
  const eventsMapRef = useRef<Map<string, CalendarEvent>>(new Map())
  const lastSyncDateRef = useRef<string>('')
  const watchActiveRef = useRef(false)

  const fetchEvents = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const now = Date.now()
      const todayBrt = getBrtDateString(now)

      if (lastSyncDateRef.current && lastSyncDateRef.current !== todayBrt) {
        syncTokenRef.current = null
        eventsMapRef.current.clear()
      }
      lastSyncDateRef.current = todayBrt

      const params = syncTokenRef.current
        ? `?syncToken=${encodeURIComponent(syncTokenRef.current)}`
        : ''
      const res = await fetch(`/api/calendar/events${params}`)

      if (!res.ok) {
        const data = await res.json()

        if (data.code === 'SYNC_TOKEN_EXPIRED') {
          syncTokenRef.current = null
          eventsMapRef.current.clear()
          const retry = await fetch('/api/calendar/events')
          if (!retry.ok) throw new Error((await retry.json()).error || 'Falha ao buscar eventos')
          const retryResult: SyncResult = await retry.json()
          applyResult(retryResult, now, todayBrt)
          return
        }

        if (data.retryable && data.retryAfterMs) {
          setTimeout(() => fetchEvents(), data.retryAfterMs)
          setState((prev) => ({ ...prev, isLoading: false, error: data.error }))
          return
        }

        throw new Error(data.error || 'Falha ao buscar eventos')
      }

      const result: SyncResult = await res.json()
      applyResult(result, now, todayBrt)
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      }))
    }
  }, [])

  const applyResult = useCallback((result: SyncResult, now: number, todayBrt: string) => {
    if (result.nextSyncToken) {
      syncTokenRef.current = result.nextSyncToken
    }

    if (result.incremental) {
      for (const id of result.cancelledIds) {
        eventsMapRef.current.delete(id)
      }
      for (const event of result.events) {
        eventsMapRef.current.set(event.id, event)
      }
    } else {
      eventsMapRef.current.clear()
      for (const event of result.events) {
        eventsMapRef.current.set(event.id, event)
      }
    }

    const config = getAdminConfig()
    const events = Array.from(eventsMapRef.current.values())
      .filter((e) => {
        const end = new Date(e.end).getTime()
        return end > now - 30 * 60 * 1000
      })
      .filter((e) => isEventToday(e, todayBrt))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, config.maxEvents)

    setState((prev) => ({
      ...prev,
      events,
      lastSync: new Date(),
      isLoading: false,
      error: null,
    }))
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

  useEffect(() => {
    async function registerWatch() {
      try {
        const res = await fetch('/api/calendar/watch', { method: 'POST' })
        if (res.ok) watchActiveRef.current = true
      } catch {}
    }
    registerWatch()
  }, [])

  useEffect(() => {
    const checkWebhook = async () => {
      if (!watchActiveRef.current) return
      try {
        const res = await fetch('/api/calendar/webhook')
        if (res.ok) {
          const { changed } = await res.json()
          if (changed) fetchEvents()
        }
      } catch {}
    }

    webhookRef.current = setInterval(checkWebhook, 15000)
    return () => {
      if (webhookRef.current) clearInterval(webhookRef.current)
    }
  }, [fetchEvents])

  return {
    ...state,
    silenceEvent,
    snoozeEvent,
    syncNow,
  }
}
