'use client'

import type { CalendarEvent } from '@/types'

interface AlarmControlsProps {
  event: CalendarEvent
  onDismiss: (eventId: string) => void
  onSnooze: (eventId: string) => void
}

export function AlarmControls({ event, onDismiss, onSnooze }: AlarmControlsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        onClick={() => onDismiss(event.id)}
        className="flex-1 rounded-xl bg-accent-green px-6 py-4 text-lg font-bold text-bg-primary transition-transform hover:scale-105 active:scale-95"
      >
        Ciente — Estou Indo
      </button>
      <button
        onClick={() => onSnooze(event.id)}
        className="rounded-xl border border-border bg-bg-elevated px-6 py-4 text-sm font-medium text-text-primary transition-transform hover:scale-105 active:scale-95"
      >
        Lembrar em 2 min
      </button>
    </div>
  )
}
