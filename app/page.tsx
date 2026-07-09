'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Header } from '@/components/Header'
import { EventList } from '@/components/EventList'
import { AlarmOverlay } from '@/components/AlarmOverlay'
import { RoomsMenu } from '@/components/RoomsMenu'
import { OnlineCounter } from '@/components/OnlineCounter'
import { useAlarmState } from '@/hooks/useAlarmState'

export default function DashboardPage() {
  const { status } = useSession()
  const { events, lastSync, isLoading, error, syncNow, silenceEvent } = useAlarmState()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-red border-t-transparent" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    redirect('/login')
  }

  return (
    <div className="min-h-screen">
      <AlarmOverlay />
      <Header lastSync={lastSync} onSyncNow={syncNow} isLoading={isLoading} />

      <main className="mx-auto max-w-4xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
            {error}
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Próximos eventos</h2>
          <span className="text-xs text-text-muted">
            {events.length} evento{events.length !== 1 ? 's' : ''}
          </span>
        </div>

        <EventList
          events={events}
          isLoading={isLoading}
          onSilence={silenceEvent}
        />
      </main>

      <RoomsMenu />
      <OnlineCounter />

      <footer className="fixed bottom-3 left-0 right-0 text-center">
        <p className="text-[10px] italic text-text-muted/50">
          por{' '}
          <a
            href="https://www.linkedin.com/in/aryribeiro"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold hover:text-text-muted"
          >
            Ary Ribeiro
          </a>
        </p>
      </footer>
    </div>
  )
}
