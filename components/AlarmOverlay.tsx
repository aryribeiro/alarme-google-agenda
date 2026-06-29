'use client'

import { useEffect, useRef } from 'react'
import { useAlarmState } from '@/hooks/useAlarmState'
import { AlarmControls } from './AlarmControls'

export function AlarmOverlay() {
  const { activeAlarms, silenceEvent, snoozeEvent, playAlarm, stopAlarm, isTestActive, dismissTest } = useAlarmState()
  const lastAlarmIdRef = useRef<string | null>(null)

  const criticalAlarm = activeAlarms.find(
    (a) => a.level === 'critical' || a.level === 'maximum'
  )

  useEffect(() => {
    if (criticalAlarm) {
      const alarmKey = `${criticalAlarm.event.id}-${criticalAlarm.level}`
      if (lastAlarmIdRef.current !== alarmKey) {
        lastAlarmIdRef.current = alarmKey
        playAlarm(criticalAlarm.level)
      }
    } else if (!isTestActive) {
      stopAlarm()
      lastAlarmIdRef.current = null
    }
  }, [criticalAlarm, playAlarm, stopAlarm, isTestActive])

  const handleDismiss = (eventId: string) => {
    stopAlarm()
    lastAlarmIdRef.current = null
    silenceEvent(eventId)
  }

  const handleSnooze = (eventId: string) => {
    stopAlarm()
    lastAlarmIdRef.current = null
    snoozeEvent(eventId)
  }

  if (isTestActive) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-pulse-red"
        style={{ backgroundColor: 'rgba(127, 29, 29, 0.98)' }}
        role="alert"
        aria-live="assertive"
      >
        <div className="w-full max-w-lg space-y-6 text-center">
          <p className="text-5xl">🚨</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            TESTE DE ALARME
          </h2>
          <p className="text-lg text-white/80">
            Som + visual funcionando. Encerrando em 5 segundos...
          </p>
          <button
            onClick={dismissTest}
            className="rounded-xl bg-accent-green px-8 py-4 text-lg font-bold text-bg-primary transition-transform hover:scale-105 active:scale-95"
          >
            OK, Funcionou!
          </button>
        </div>
      </div>
    )
  }

  if (!criticalAlarm) return null

  const { event, level } = criticalAlarm
  const isMaximum = level === 'maximum'

  const startTime = new Date(event.start).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${
        isMaximum ? 'animate-pulse-red' : ''
      }`}
      style={{ backgroundColor: isMaximum ? 'rgba(127, 29, 29, 0.98)' : 'rgba(127, 29, 29, 0.90)' }}
      role="alert"
      aria-live="assertive"
    >
      <div className="w-full max-w-lg space-y-6 text-center">
        <p className="text-5xl">
          {isMaximum ? '🚨' : '⚠️'}
        </p>

        <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {isMaximum ? 'REUNIÃO AGORA' : 'REUNIÃO EM BREVE'}
        </h2>

        <p className="text-xl font-semibold text-white/90">
          {event.summary}
        </p>

        <p className="text-5xl font-extrabold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {startTime}
        </p>

        {event.hangoutLink && (
          <a
            href={event.hangoutLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-green px-8 py-4 text-lg font-bold text-bg-primary transition-transform hover:scale-105"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
            Entrar no Meet
          </a>
        )}

        {!event.hangoutLink && event.externalLink && (
          <a
            href={event.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-orange px-8 py-4 text-lg font-bold text-bg-primary transition-transform hover:scale-105"
          >
            <span className="text-2xl">🔗</span>
            Entrar na Reunião
          </a>
        )}

        <AlarmControls
          event={event}
          onDismiss={handleDismiss}
          onSnooze={handleSnooze}
        />
      </div>
    </div>
  )
}
