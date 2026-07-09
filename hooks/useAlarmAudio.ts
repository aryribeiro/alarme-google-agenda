'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlarmLevel } from '@/types'
import { getVolumeForLevel } from '@/lib/alarmLogic'
import { getAdminConfig } from '@/lib/adminAuth'

export function useAlarmAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isUnlockedRef = useRef(false)
  const useFallbackRef = useRef(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const audio = new Audio('/som/som.mp3')
    audio.preload = 'auto'
    audio.loop = true

    audio.addEventListener('canplaythrough', () => {
      useFallbackRef.current = false
    })

    audio.addEventListener('error', () => {
      useFallbackRef.current = true
    })

    audioRef.current = audio

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  const unlock = useCallback(async () => {
    if (isUnlockedRef.current) return
    try {
      const audio = audioRef.current
      if (audio) {
        audio.volume = 0.01
        await audio.play()
        audio.pause()
        audio.currentTime = 0
        audio.volume = 1.0
      }

      const ctx = new AudioContext()
      await ctx.resume()
      audioContextRef.current = ctx

      isUnlockedRef.current = true
      setIsUnlocked(true)
    } catch {
      // Browser blocked — will retry on next interaction
    }
  }, [])

  useEffect(() => {
    const tryUnlock = () => unlock()
    document.addEventListener('click', tryUnlock, true)
    document.addEventListener('touchstart', tryUnlock, true)
    document.addEventListener('keydown', tryUnlock, true)
    return () => {
      document.removeEventListener('click', tryUnlock, true)
      document.removeEventListener('touchstart', tryUnlock, true)
      document.removeEventListener('keydown', tryUnlock, true)
    }
  }, [unlock])

  const playFallbackBeep = useCallback((volume: number) => {
    const ctx = audioContextRef.current
    if (!ctx) return

    const config = getAdminConfig()

    const playOnce = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'square'
      osc.frequency.value = config.fallbackFrequency
      osc.connect(gain)
      gain.connect(ctx.destination)

      const now = ctx.currentTime
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(volume, now + 0.01)
      gain.gain.setValueAtTime(volume, now + 0.31)
      gain.gain.linearRampToValueAtTime(0, now + 0.41)

      osc.start(now)
      osc.stop(now + 0.42)
    }

    playOnce()
    fallbackIntervalRef.current = setInterval(playOnce, 600)
  }, [])

  const play = useCallback((level: AlarmLevel) => {
    if (!isUnlockedRef.current) return

    const config = getAdminConfig()
    const volume = getVolumeForLevel(level, config)
    if (volume === 0) return

    if (useFallbackRef.current) {
      playFallbackBeep(volume)
    } else {
      const audio = audioRef.current
      if (!audio) return
      audio.volume = volume
      audio.loop = level === 'critical' || level === 'maximum'
      audio.currentTime = 0
      audio.play().catch(() => {
        useFallbackRef.current = true
        playFallbackBeep(volume)
      })
    }

    setIsPlaying(true)

    if (config.vibrationEnabled && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200])
    }
  }, [playFallbackBeep])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }

    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current)
      fallbackIntervalRef.current = null
    }

    if (navigator.vibrate) {
      navigator.vibrate(0)
    }

    setIsPlaying(false)
  }, [])

  return { isUnlocked, unlock, play, stop, isPlaying }
}
