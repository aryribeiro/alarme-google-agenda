'use client'

import { signIn } from 'next-auth/react'
import { useEffect, useState } from 'react'

// Aberto pelo app Android: leva ao login do Google com a mesma conta do site e devolve ao app
export default function AppEntrarPage() {
  const [desafio, setDesafio] = useState<string | null>(null)
  const [invalido, setInvalido] = useState(false)

  const entrar = (c: string) => {
    signIn('google', { callbackUrl: `/api/app/conectar?c=${encodeURIComponent(c)}` })
  }

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c')
    if (!c || !/^[A-Za-z0-9_-]{43}$/.test(c)) {
      setInvalido(true)
      return
    }
    setDesafio(c)
    entrar(c)
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <img src="/som/logo.png" alt="Logo" className="mx-auto h-16 w-auto" />
        <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">Alarme Google Agenda 2026</h1>
        {invalido ? (
          <p className="text-sm text-text-muted">Abra o app Alarme Agenda no celular e toque em <b>Entrar com Google</b>.</p>
        ) : (
          <>
            <p className="text-sm text-text-muted">Conectando o app à sua conta do Google…</p>
            {desafio && (
              <button
                onClick={() => entrar(desafio)}
                className="w-full rounded-xl border border-border bg-bg-card px-6 py-4 text-base font-semibold text-text-primary"
              >
                Entrar com Google
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
