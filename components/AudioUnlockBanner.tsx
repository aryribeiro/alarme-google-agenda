'use client'

import { useAlarmState } from '@/hooks/useAlarmState'

export function AudioUnlockBanner() {
  const { isAudioUnlocked, unlockAudio } = useAlarmState()

  if (isAudioUnlocked) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] border-b border-accent-orange/40 bg-accent-orange/95 px-4 py-2.5 text-center shadow-lg backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="flex items-center gap-2 text-left">
          <span className="text-xl">🔔</span>
          <div>
            <p className="text-xs sm:text-sm font-bold text-bg-primary">
              Ative o som do alarme para este dispositivo
            </p>
            <p className="text-[11px] text-bg-primary/80">
              Necessário para o alarme tocar em segundo plano e com a tela desligada no celular.
            </p>
          </div>
        </div>
        <button
          onClick={unlockAudio}
          className="whitespace-nowrap rounded-lg bg-bg-primary px-5 py-2 text-xs sm:text-sm font-bold text-text-primary shadow transition-all hover:scale-105 active:scale-95 hover:bg-black"
        >
          Ativar Som Agora
        </button>
      </div>
    </div>
  )
}
