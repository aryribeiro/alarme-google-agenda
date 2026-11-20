'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlarmLevel, CalendarEvent } from '@/types'
import { getAdminConfig } from '@/lib/adminAuth'

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
        // O Web Push saiu do app (20/11/2026): desfaz a inscrição antiga deste navegador.
        // Sem destino, o vigia que ainda rodar no servidor recebe "não existe" e se encerra sozinho.
        reg.pushManager?.getSubscription().then((sub) => sub?.unsubscribe()).catch(() => undefined)
      })
      try {
        localStorage.removeItem('alarme-push-hello')
      } catch {}
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

    const config = getAdminConfig()
    const title = level === 'maximum'
      ? `🚨 REUNIÃO AGORA: ${event.summary}`
      : level === 'critical'
        ? `⚠️ Em ${config.criticalMinutes} min: ${event.summary}`
        : level === 'urgent'
          ? `🔔 Em ${config.urgentMinutes} min: ${event.summary}`
          : `📅 Em ${config.warningMinutes} min: ${event.summary}`

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
        level,
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

  return { permission, requestPermission, sendNotification }
}
