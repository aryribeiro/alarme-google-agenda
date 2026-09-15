'use client'

import { useAlarmState } from '@/hooks/useAlarmState'
import { useWakeLock } from '@/hooks/useWakeLock'

export function MobileStatusCard() {
  const { isAudioUnlocked, unlockAudio } = useAlarmState()
  const { isSupported: wakeLockSupported, isLocked: isWakeLocked, requestWakeLock, releaseWakeLock } = useWakeLock()

  const toggleWakeLock = async () => {
    if (isWakeLocked) {
      await releaseWakeLock()
    } else {
      await requestWakeLock()
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-border/60 bg-bg-card/70 p-3.5 backdrop-blur-sm shadow-sm transition-all">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isAudioUnlocked ? 'bg-accent-green shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-accent-orange animate-pulse'
              }`}
            />
            <span className="font-semibold text-text-primary">
              {isAudioUnlocked ? 'Alarme em 2º Plano Ativo' : 'Áudio Aguardando Ativação'}
            </span>
          </div>

          <span className="hidden sm:inline text-border">|</span>

          <span className="text-text-muted">
            {isAudioUnlocked
              ? 'Toca mesmo com a tela desligada'
              : 'Clique em ativar som para tocar com tela desligada'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isAudioUnlocked && (
            <button
              onClick={unlockAudio}
              className="rounded-lg bg-accent-orange px-3 py-1.5 text-xs font-bold text-bg-primary transition-transform hover:scale-105 active:scale-95"
            >
              Ativar Som
            </button>
          )}

          {wakeLockSupported && (
            <button
              onClick={toggleWakeLock}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors border ${
                isWakeLocked
                  ? 'border-accent-green/40 bg-accent-green/10 text-accent-green'
                  : 'border-border bg-bg-elevated/60 text-text-muted hover:text-text-primary'
              }`}
              title="Evita que a tela do celular apague automaticamente (útil para suporte na mesa)"
            >
              {isWakeLocked ? '☀️ Tela sempre acesa: ON' : '🌙 Manter tela acesa: OFF'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
