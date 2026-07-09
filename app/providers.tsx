'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlarmContext } from '@/hooks/useAlarmState'
import { useCalendarPolling } from '@/hooks/useCalendarPolling'
import { useAlarmAudio } from '@/hooks/useAlarmAudio'
import { useNotifications } from '@/hooks/useNotifications'
import { isEventSilencedToday } from '@/lib/alarmLogic'
import { getAdminConfig } from '@/lib/adminAuth'

function AlarmProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const polling = useCalendarPolling()
  const audio = useAlarmAudio()
  const notifications = useNotifications()
  const [isTestActive, setIsTestActive] = useState(false)
  const testTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && notifications.permission === 'default') {
      notifications.requestPermission()
    }
  }, [status, notifications.permission, notifications.requestPermission])

  useEffect(() => {
    const alarms = status === 'authenticated' ? polling.activeAlarms : []
    for (const alarm of alarms) {
      notifications.sendNotification(alarm.event, alarm.level)
    }
  }, [status, polling.activeAlarms, notifications.sendNotification])

  useEffect(() => {
    if (status !== 'authenticated' || !('serviceWorker' in navigator)) return

    const sendSchedule = () => {
      navigator.serviceWorker.ready.then((reg) => {
        const sw = reg.active
        if (!sw) return

        const now = Date.now()
        const config = getAdminConfig()
        const schedule: Array<{ fireAt: number; title: string; body: string; tag: string; level: string; url: string }> = []

        for (const event of polling.events) {
          if (isEventSilencedToday(event.id)) continue

          const startTime = new Date(event.start).getTime()
          const startStr = new Date(event.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          const body = `${startStr}${event.hangoutLink ? ' — Google Meet disponível' : ''}`
          const url = event.hangoutLink || '/'

          const levels = [
            { level: 'warning', min: config.warningMinutes, emoji: '📅', prefix: `Em ${config.warningMinutes} min` },
            { level: 'urgent', min: config.urgentMinutes, emoji: '🔔', prefix: `Em ${config.urgentMinutes} min` },
            { level: 'critical', min: config.criticalMinutes, emoji: '⚠️', prefix: `Em ${config.criticalMinutes} min` },
            { level: 'maximum', min: 0, emoji: '🚨', prefix: 'REUNIÃO AGORA' },
          ]

          for (const { level, min, emoji, prefix } of levels) {
            const fireAt = startTime - min * 60000
            const isUrgent = level === 'critical' || level === 'maximum'

            if (fireAt > now && fireAt < now + 35 * 60000) {
              schedule.push({ fireAt, title: `${emoji} ${prefix}: ${event.summary}`, body, tag: event.id, level, url })
            } else if (isUrgent && fireAt <= now && startTime > now - 30 * 60000) {
              schedule.push({ fireAt: now + 30000, title: `${emoji} ${prefix}: ${event.summary}`, body, tag: event.id, level, url })
            }
          }
        }

        sw.postMessage({ type: 'SCHEDULE_ALARMS', alarms: schedule })
      })
    }

    sendSchedule()
    const interval = setInterval(sendSchedule, 30000)

    const handleHidden = () => {
      if (document.visibilityState === 'hidden') sendSchedule()
    }
    document.addEventListener('visibilitychange', handleHidden)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleHidden)
    }
  }, [status, polling.events])

  const silenceEvent = useCallback((eventId: string) => {
    audio.stop()
    polling.silenceEvent(eventId)
  }, [audio.stop, polling.silenceEvent])

  const snoozeEvent = useCallback((eventId: string) => {
    audio.stop()
    polling.snoozeEvent(eventId)
  }, [audio.stop, polling.snoozeEvent])

  const dismissTest = useCallback(() => {
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current)
      testTimeoutRef.current = null
    }
    audio.stop()
    setIsTestActive(false)
  }, [audio.stop])

  const testAlarm = useCallback(() => {
    if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current)
    setIsTestActive(true)
    audio.play('maximum')
    testTimeoutRef.current = setTimeout(() => {
      audio.stop()
      setIsTestActive(false)
    }, 5000)
  }, [audio.play, audio.stop])

  const activeAlarms = status === 'authenticated' ? polling.activeAlarms : []
  const events = status === 'authenticated' ? polling.events : []

  const value = useMemo(() => ({
    events,
    activeAlarms,
    lastSync: polling.lastSync,
    isLoading: polling.isLoading,
    error: polling.error,
    syncNow: polling.syncNow,
    silenceEvent,
    snoozeEvent,
    isAudioUnlocked: audio.isUnlocked,
    unlockAudio: audio.unlock,
    playAlarm: audio.play,
    stopAlarm: audio.stop,
    isPlaying: audio.isPlaying,
    testAlarm,
    dismissTest,
    isTestActive,
  }), [events, activeAlarms, polling.lastSync, polling.isLoading, polling.error, polling.syncNow, silenceEvent, snoozeEvent, audio.isUnlocked, audio.unlock, audio.play, audio.stop, audio.isPlaying, testAlarm, dismissTest, isTestActive])

  return (
    <AlarmContext.Provider value={value}>
      {children}
    </AlarmContext.Provider>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AlarmProvider>{children}</AlarmProvider>
    </SessionProvider>
  )
}
