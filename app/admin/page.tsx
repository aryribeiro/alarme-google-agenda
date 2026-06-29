'use client'

import { useState, useEffect } from 'react'
import { AdminPanel } from '@/components/AdminPanel'
import {
  verifyAdminPassword,
  setAdminSession,
  isAdminSessionValid,
  clearAdminSession,
} from '@/lib/adminAuth'

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    setIsAuthenticated(isAdminSessionValid())
    setChecking(false)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const valid = await verifyAdminPassword(password)
    if (valid) {
      setAdminSession()
      setIsAuthenticated(true)
      setPassword('')
    } else {
      setError('Senha incorreta')
    }
  }

  const handleLogout = () => {
    clearAdminSession()
    setIsAuthenticated(false)
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-red border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-extrabold text-text-primary">Painel Admin</h1>
          <p className="text-sm text-text-muted">Digite a senha para acessar as configurações.</p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha admin"
            className="w-full rounded-lg border border-border bg-bg-card px-4 py-3 text-text-primary placeholder:text-text-muted/50 focus:border-accent-red focus:outline-none"
            autoFocus
          />

          {error && <p className="text-sm text-accent-red">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-lg bg-accent-red px-4 py-3 font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Entrar
          </button>

          <a href="/" className="block text-center text-sm text-text-muted hover:text-text-primary">
            ← Voltar ao dashboard
          </a>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-text-primary">Configurações</h1>
          <div className="flex gap-3">
            <a href="/" className="text-sm text-text-muted hover:text-text-primary">
              ← Dashboard
            </a>
            <button
              onClick={handleLogout}
              className="text-sm text-accent-red hover:underline"
            >
              Logout admin
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg-card p-6">
          <AdminPanel />
        </div>
      </div>
    </div>
  )
}
