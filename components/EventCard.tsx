'use client'

import { useEffect, useState } from 'react'
import type { CalendarEvent, AlarmLevel } from '@/types'
import { getMinutesUntilEvent, calculateAlarmLevel, isEventSilencedToday } from '@/lib/alarmLogic'
import { getAdminConfig } from '@/lib/adminAuth'

interface EventCardProps {
  event: CalendarEvent
  onSilence: (eventId: string) => void
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return 'AGORA'
  if (minutes < 1) return 'em < 1 min'
  if (minutes < 60) return `em ${Math.floor(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  return `em ${h}h ${m}min`
}

function getLevelColor(level: AlarmLevel | null): string {
  switch (level) {
    case 'maximum':
    case 'critical':
      return 'text-accent-red-bright'
    case 'urgent':
      return 'text-accent-orange'
    case 'warning':
      return 'text-accent-yellow'
    default:
      return 'text-text-muted'
  }
}

function getRingProgress(minutes: number): number {
  if (minutes <= 0) return 100
  if (minutes >= 60) return 0
  return ((60 - minutes) / 60) * 100
}

function getRingColor(minutes: number): string {
  if (minutes <= 5) return '#FF1744'
  if (minutes <= 10) return '#F57C00'
  if (minutes <= 30) return '#F9A825'
  return '#9E9E9E'
}

export function EventCard({ event, onSilence }: EventCardProps) {
  const [minutes, setMinutes] = useState(() => getMinutesUntilEvent(event))
  const [level, setLevel] = useState<AlarmLevel | null>(null)
  const [isSilenced, setIsSilenced] = useState(() => isEventSilencedToday(event.id))

  useEffect(() => {
    const update = () => {
      const m = getMinutesUntilEvent(event)
      setMinutes(m)
      setLevel(calculateAlarmLevel(m, getAdminConfig()))
      setIsSilenced(isEventSilencedToday(event.id))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [event])

  const handleSilence = () => {
    onSilence(event.id)
    setIsSilenced(true)
  }

  const progress = getRingProgress(minutes)
  const ringColor = getRingColor(minutes)
  const circumference = 2 * Math.PI * 20
  const dashOffset = circumference - (progress / 100) * circumference

  const borderClass = isSilenced
    ? 'border-border opacity-50'
    : level === 'urgent' || level === 'critical' || level === 'maximum'
      ? 'animate-ring-danger'
      : 'border-border'

  return (
    <div className={`rounded-xl border bg-bg-card p-4 transition-all ${borderClass}`}>
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <svg width="48" height="48" className="-rotate-90">
            <circle
              cx="24" cy="24" r="20"
              fill="none"
              stroke="#2A2A3A"
              strokeWidth="3"
            />
            <circle
              cx="24" cy="24" r="20"
              fill="none"
              stroke={ringColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-1000"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {minutes <= 0 ? '!' : Math.floor(minutes) + '\''}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-text-primary" title={event.summary}>
            {event.summary}
          </h3>
          <p className="mt-0.5 text-xs text-text-muted" style={{ fontFeatureSettings: '"tnum"' }}>
            {formatTime(event.start)} → {formatTime(event.end)}
          </p>
          <p className={`mt-1 text-xs font-semibold ${getLevelColor(level)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCountdown(minutes)}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          {event.hangoutLink && (
            <a
              href={event.hangoutLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-accent-green/10 p-2 text-accent-green hover:bg-accent-green/20"
              title="Entrar no Meet"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            </a>
          )}
          {!event.hangoutLink && event.externalLink && (
            <a
              href={event.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-accent-orange/10 p-2 text-accent-orange hover:bg-accent-orange/20"
              title="Abrir link da reunião"
            >
              <span className="text-base leading-none">🔗</span>
            </a>
          )}
          {!isSilenced ? (
            <button
              onClick={handleSilence}
              className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
              title="Silenciar este evento"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 16.5l-4-4m0 0l-4-4m4 4l4-4m-4 4l-4 4"/>
              </svg>
            </button>
          ) : (
            <span className="rounded-lg p-2 text-text-muted" title="Evento silenciado">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14"/>
              </svg>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
