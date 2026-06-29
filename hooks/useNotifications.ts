'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlarmLevel, CalendarEvent } from '@/types'

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const swRef = useRef<ServiceWorkerRegistration | null>(null)
  const notifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return

    setPermission(Notification.permission)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        swRef.current = reg
      })
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied' as NotificationPermission
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  const sendNotification = useCallback((event: CalendarEvent, level: AlarmLevel) => {
    if (permission !== 'granted') return

    const notifKey = `${event.id}-${level}`
    if (notifiedRef.current.has(notifKey)) return
    notifiedRef.current.add(notifKey)

    const title = level === 'maximum'
      ? `🚨 REUNIÃO AGORA: ${event.summary}`
      : level === 'critical'
        ? `⚠️ Em 5 min: ${event.summary}`
        : level === 'urgent'
          ? `🔔 Em 10 min: ${event.summary}`
          : `📅 Em 30 min: ${event.summary}`

    const startTime = new Date(event.start).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const body = `${startTime}${event.hangoutLink ? ' — Google Meet disponível' : ''}`

    const sw = swRef.current
    if (sw?.active) {
      sw.active.postMessage({
        type: 'ALARM',
        title,
        body,
        tag: event.id,
        url: event.hangoutLink || '/',
      })
    } else {
      new Notification(title, {
        body,
        tag: event.id,
        icon: '/som/logo.png',
        requireInteraction: true,
      })
    }
  }, [permission])

  const clearNotified = useCallback((eventId: string) => {
    notifiedRef.current.forEach((key) => {
      if (key.startsWith(eventId)) {
        notifiedRef.current.delete(key)
      }
    })
  }, [])

  return { permission, requestPermission, sendNotification, clearNotified }
}
