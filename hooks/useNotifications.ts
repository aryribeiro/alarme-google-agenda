'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlarmLevel, CalendarEvent } from '@/types'
import { getAdminConfig } from '@/lib/adminAuth'

const HELLO_STORAGE_KEY = 'alarme-push-hello'
// O "olá" acorda o vigia no servidor; repetir a cada carregamento gastaria a cota à toa
const HELLO_INTERVAL_MS = 2 * 60 * 60 * 1000

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function helloIsFresh(endpoint: string, criticalMinutes: number): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(HELLO_STORAGE_KEY) || 'null')
    return stored?.endpoint === endpoint
      && stored.criticalMinutes === criticalMinutes
      && Date.now() - stored.at < HELLO_INTERVAL_MS
  } catch {
    return false
  }
}

export function forgetPushHello(): void {
  try {
    localStorage.removeItem(HELLO_STORAGE_KEY)
  } catch {}
}

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

  /**
   * Registra este aparelho no vigia do servidor, que avisa mesmo com a tela apagada.
   * Sem suporte a push (ou no iPhone fora da Tela de Início) simplesmente não registra.
   */
  const registerPush = useCallback(async () => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey || !('serviceWorker' in navigator)) return

    try {
      const reg = await navigator.serviceWorker.ready
      if (!('pushManager' in reg)) return

      const subscription = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) }))

      const { criticalMinutes } = getAdminConfig()
      if (helloIsFresh(subscription.endpoint, criticalMinutes)) return

      const res = await fetch('/api/push/hello', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), criticalMinutes }),
      })
      if (res.ok) {
        localStorage.setItem(HELLO_STORAGE_KEY, JSON.stringify({ endpoint: subscription.endpoint, criticalMinutes, at: Date.now() }))
      }
    } catch {
      // Sem push o alarme da página continua valendo; tenta de novo no próximo carregamento
    }
  }, [])

  /** Ao sair da conta: este aparelho deixa de receber avisos. */
  const unregisterPush = useCallback(async () => {
    forgetPushHello()
    try {
      const reg = await navigator.serviceWorker?.ready
      const subscription = await reg?.pushManager?.getSubscription()
      if (!subscription) return

      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      await subscription.unsubscribe()
    } catch {}
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

  return { permission, requestPermission, sendNotification, registerPush, unregisterPush }
}
