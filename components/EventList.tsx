'use client'

import type { CalendarEvent } from '@/types'
import { EventCard } from './EventCard'

interface EventListProps {
  events: CalendarEvent[]
  isLoading: boolean
  onSilence: (eventId: string) => void
}

export function EventList({ events, isLoading, onSilence }: EventListProps) {
  if (isLoading && events.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-card" />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-card p-8 text-center">
        <p className="text-lg font-semibold text-accent-green">Agenda limpa!</p>
        <p className="mt-1 text-sm text-text-muted">
          Sem reuniões para hoje.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} onSilence={onSilence} />
      ))}
    </div>
  )
}
