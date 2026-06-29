'use client'

import { useState, useEffect } from 'react'
import type { Room } from '@/types'

export function RoomsMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadRooms() {
      setLoading(true)
      try {
        const res = await fetch('/api/calendar/rooms')
        if (res.ok) {
          const data = await res.json()
          setRooms(data)
        }
      } catch {
        // silently fail — menu just stays empty
      } finally {
        setLoading(false)
      }
    }
    loadRooms()
  }, [])

  return (
    <div className="fixed bottom-12 left-4 z-50">
      {isOpen && (
        <div className="mb-2 rounded-xl border border-border bg-bg-card p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Salas de Reunião
          </p>
          {loading ? (
            <p className="px-3 py-2 text-xs text-text-muted">Carregando...</p>
          ) : rooms.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-muted">Nenhuma sala encontrada</p>
          ) : (
            <ul className="space-y-1">
              {rooms.map((room) => (
                <li key={room.name}>
                  <a
                    href={room.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-bg-elevated transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#00C853">
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    </svg>
                    {room.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg-card text-text-primary hover:bg-bg-elevated transition-colors"
        title="Salas de reunião"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  )
}
