'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AdminConfig } from '@/types'
import { DEFAULT_CONFIG } from '@/types'
import {
  getAdminConfig,
  saveAdminConfig,
  resetAdminConfig,
  hashPassword,
} from '@/lib/adminAuth'
import { useAlarmState } from '@/hooks/useAlarmState'

export function AdminPanel() {
  const [config, setConfig] = useState<AdminConfig>(DEFAULT_CONFIG)
  const [newPassword, setNewPassword] = useState('')
  const [saved, setSaved] = useState(false)
  const { playAlarm: play, stopAlarm: stop, unlockAudio: unlock, isAudioUnlocked: isUnlocked } = useAlarmState()

  useEffect(() => {
    setConfig(getAdminConfig())
  }, [])

  const handleSave = useCallback(async () => {
    const toSave = { ...config }
    if (newPassword) {
      toSave.adminPasswordHash = await hashPassword(newPassword)
      setNewPassword('')
    }
    saveAdminConfig(toSave)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [config, newPassword])

  const handleReset = useCallback(() => {
    resetAdminConfig()
    setConfig(DEFAULT_CONFIG)
    setNewPassword('')
  }, [])

  const handleTestAlarm = useCallback(async () => {
    if (!isUnlocked) await unlock()
    play('critical')
    setTimeout(stop, 5000)
  }, [isUnlocked, unlock, play, stop])

  const update = <K extends keyof AdminConfig>(key: K, value: AdminConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Polling
        </h3>
        <label className="flex items-center justify-between">
          <span className="text-sm text-text-primary">Intervalo de polling (min)</span>
          <input
            type="number"
            min={1}
            max={30}
            value={config.pollingInterval}
            onChange={(e) => update('pollingInterval', Number(e.target.value))}
            className="w-20 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary"
          />
        </label>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Alarmes
        </h3>
        <label className="flex items-center justify-between">
          <span className="text-sm text-text-primary">Warning (min antes)</span>
          <input
            type="number"
            min={1}
            max={120}
            value={config.warningMinutes}
            onChange={(e) => update('warningMinutes', Number(e.target.value))}
            className="w-20 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary"
          />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm text-text-primary">Urgent (min antes)</span>
          <input
            type="number"
            min={1}
            max={60}
            value={config.urgentMinutes}
            onChange={(e) => update('urgentMinutes', Number(e.target.value))}
            className="w-20 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary"
          />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm text-text-primary">Critical (min antes)</span>
          <input
            type="number"
            min={1}
            max={30}
            value={config.criticalMinutes}
            onChange={(e) => update('criticalMinutes', Number(e.target.value))}
            className="w-20 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary"
          />
        </label>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Som
        </h3>
        <label className="flex items-center justify-between">
          <span className="text-sm text-text-primary">Volume: {config.volume}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={config.volume}
            onChange={(e) => update('volume', Number(e.target.value))}
            className="w-32"
          />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm text-text-primary">Tom fallback (Hz)</span>
          <input
            type="number"
            min={200}
            max={2000}
            value={config.fallbackFrequency}
            onChange={(e) => update('fallbackFrequency', Number(e.target.value))}
            className="w-20 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary"
          />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm text-text-primary">Vibração mobile</span>
          <input
            type="checkbox"
            checked={config.vibrationEnabled}
            onChange={(e) => update('vibrationEnabled', e.target.checked)}
            className="h-4 w-4"
          />
        </label>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Geral
        </h3>
        <label className="flex items-center justify-between">
          <span className="text-sm text-text-primary">Max eventos exibidos</span>
          <input
            type="number"
            min={1}
            max={50}
            value={config.maxEvents}
            onChange={(e) => update('maxEvents', Number(e.target.value))}
            className="w-20 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary"
          />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm text-text-primary">Nova senha admin</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Deixe vazio para manter"
            className="w-48 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted/50"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3 pt-4">
        <button
          onClick={handleSave}
          className="rounded-lg bg-accent-green px-5 py-2.5 text-sm font-bold text-bg-primary transition-transform hover:scale-105 active:scale-95"
        >
          {saved ? 'Salvo!' : 'Salvar configurações'}
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg bg-bg-elevated px-5 py-2.5 text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          Restaurar padrões
        </button>
        <button
          onClick={handleTestAlarm}
          className="rounded-lg bg-accent-red px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
        >
          Testar alarme (5s)
        </button>
      </div>
    </div>
  )
}
