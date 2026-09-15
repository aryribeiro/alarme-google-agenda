'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useWakeLock() {
  const [isLocked, setIsLocked] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  const shouldLockRef = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      setIsSupported(true)
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    shouldLockRef.current = false
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release()
      } catch {}
      sentinelRef.current = null
      setIsLocked(false)
    }
  }, [])

  const requestWakeLock = useCallback(async () => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) return false
    shouldLockRef.current = true

    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        setIsLocked(true)
        return true
      }

      const sentinel = await navigator.wakeLock.request('screen')
      sentinelRef.current = sentinel
      setIsLocked(true)

      sentinel.addEventListener('release', () => {
        setIsLocked(false)
        sentinelRef.current = null
      })

      return true
    } catch {
      setIsLocked(false)
      return false
    }
  }, [])

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && shouldLockRef.current) {
        await requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [requestWakeLock])

  return { isSupported, isLocked, requestWakeLock, releaseWakeLock }
}
