'use client'

import { useEffect, useState } from 'react'
import { useAlarmState } from '@/hooks/useAlarmState'

export function AudioUnlockBanner() {
  const { isAudioUnlocked, unlockAudio } = useAlarmState()
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    setIsAndroid(/Android/i.test(navigator.userAgent))
  }, [])

  if (isAudioUnlocked) return null

  return (
    // No celular a faixa ocupa o seu espaço (fixa, cobria o topo da página); no PC continua fixa no topo
    <div className="relative z-[9998] border-b border-accent-orange/40 bg-accent-orange px-4 py-2.5 text-center shadow-lg sm:fixed sm:top-0 sm:left-0 sm:right-0">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="flex items-center gap-2 text-left">
          <span className="text-xl">🔔</span>
          <div>
            <p className="text-xs sm:text-sm font-bold text-bg-primary">
              Ative o som do alarme para este dispositivo
            </p>
            <p className="text-[11px] text-bg-primary/80">
              {isAndroid
                ? 'Necessário para o alarme tocar com esta página aberta. Com a tela apagada, quem toca é o app Android.'
                : 'Necessário para o alarme tocar em segundo plano e com a tela desligada no celular.'}
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
