'use client'

import { signOut, useSession } from 'next-auth/react'
import { useAlarmState } from '@/hooks/useAlarmState'

function TestAlarmButton() {
  const { testAlarm, isTestActive, isAudioUnlocked, unlockAudio } = useAlarmState()

  const handleClick = async () => {
    if (!isAudioUnlocked) await unlockAudio()
    testAlarm()
  }

  return (
    <button
      onClick={handleClick}
      disabled={isTestActive}
      className="rounded px-2 py-1 text-xs text-accent-red hover:bg-bg-elevated disabled:opacity-50"
      title="Testar alarme (5s)"
    >
      {isTestActive ? '🔊 ...' : '🔔 Teste'}
    </button>
  )
}

interface HeaderProps {
  lastSync: Date | null
  onSyncNow: () => void
  isLoading: boolean
}

export function Header({ lastSync, onSyncNow, isLoading }: HeaderProps) {
  const { data: session } = useSession()
  const { activeAlarms } = useAlarmState()

  const timeSinceSync = lastSync
    ? Math.floor((Date.now() - lastSync.getTime()) / 60000)
    : null

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-primary/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <img src="/som/logo.png" alt="Logo" className="h-7 w-auto" />
          <h1 className="text-sm font-extrabold tracking-tight text-text-primary">
            Alarme Google Agenda 2026
          </h1>
          {activeAlarms.length > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-red px-1.5 text-xs font-bold text-white">
              {activeAlarms.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
            <span className="text-xs text-text-muted">
              {timeSinceSync !== null
                ? timeSinceSync === 0
                  ? 'Sincronizado agora'
                  : `Há ${timeSinceSync} min`
                : 'Aguardando...'}
            </span>
            <button
              onClick={onSyncNow}
              disabled={isLoading}
              className="rounded px-2 py-1 text-xs text-accent-green hover:bg-bg-elevated disabled:opacity-50"
            >
              {isLoading ? '...' : '🔄 Sync'}
            </button>
          </div>

          {session?.user && (
            <div className="flex items-center gap-2">
              <TestAlarmButton />
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="h-7 w-7 rounded-full"
                />
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="rounded px-2 py-1 text-sm font-bold text-text-primary hover:bg-bg-elevated"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
