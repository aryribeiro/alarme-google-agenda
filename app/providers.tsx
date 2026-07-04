'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlarmContext } from '@/hooks/useAlarmState'
import { useCalendarPolling } from '@/hooks/useCalendarPolling'
import { useAlarmAudio } from '@/hooks/useAlarmAudio'
import { useNotifications } from '@/hooks/useNotifications'

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
