'use client'

import { useState, useEffect, useCallback } from 'react'

export function OnlineCounter() {
  const [count, setCount] = useState<number | null>(null)

  const sendHeartbeat = useCallback(async () => {
    try {
      const res = await fetch('/api/presence', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setCount(data.online)
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 5 * 60_000)
    return () => clearInterval(interval)
  }, [sendHeartbeat])

  if (count === null) return null

  return (
    <div
      className="fixed bottom-12 right-4 z-50 flex items-center gap-1.5 rounded-full border border-border bg-bg-card px-3 py-1.5 shadow-sm"
      title={`${count} pessoa${count !== 1 ? 's' : ''} online nos últimos 5 min`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text-muted"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span className="text-xs font-medium text-text-muted">{count}</span>
    </div>
  )
}
