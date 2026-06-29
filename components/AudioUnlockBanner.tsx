'use client'

import { useAlarmState } from '@/hooks/useAlarmState'

export function AudioUnlockBanner() {
  const { isAudioUnlocked, unlockAudio } = useAlarmState()

  if (isAudioUnlocked) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-accent-orange/95 px-4 py-3 text-center backdrop-blur-sm">
      <p className="mb-2 text-sm font-medium text-bg-primary">
        Clique abaixo para ativar o sistema de alarme sonoro
      </p>
      <button
        onClick={unlockAudio}
        className="rounded-lg bg-bg-primary px-6 py-2 text-sm font-bold text-text-primary transition-transform hover:scale-105 active:scale-95"
      >
        Ativar Som do Alarme
      </button>
    </div>
  )
}
