// Como as rotas falam com o vigia de um usuário: acorda o que existe ou inicia um novo.
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import { resumeHook, start } from 'workflow/api'
import { HookNotFoundError } from 'workflow/errors'
import { vigiaAgenda } from '../workflows/vigia'
import type { PushSub, Signal } from './pushPlan'
import { encryptSecret, hookTokenFor, userKeyFor } from './vigiaKeys'

export interface VigiaIdentity {
  userKey: string
  token: string
  encRefreshToken: string
}

/** Identidade do vigia a partir da sessão. null = sem login ou sem credencial para o servidor agir sozinho. */
export async function getVigiaIdentity(request: NextRequest): Promise<VigiaIdentity | null> {
  const secret = process.env.NEXTAUTH_SECRET
  const jwt = await getToken({ req: request })
  if (!secret || !jwt?.email || !jwt.refreshToken || jwt.error) return null

  const userKey = userKeyFor(jwt.email, secret)
  return { userKey, token: hookTokenFor(userKey), encRefreshToken: encryptSecret(jwt.refreshToken, secret) }
}

/** Entrega um sinal ao vigia. false = não há vigia ativo para esse usuário. */
export async function signalVigia(token: string, signal: Signal): Promise<boolean> {
  try {
    await resumeHook(token, signal)
    return true
  } catch (error) {
    if (HookNotFoundError.is(error)) return false
    throw error
  }
}

export async function helloVigia(identity: VigiaIdentity, sub: PushSub, criticalMinutes: number): Promise<'acordado' | 'iniciado'> {
  const now = Date.now()
  const { userKey, token, encRefreshToken } = identity

  if (await signalVigia(token, { type: 'hello', at: now, sub, encRefreshToken, criticalMinutes })) return 'acordado'

  await start(vigiaAgenda, [
    { state: { userKey, encRefreshToken, subs: [sub], fired: [], silenced: [], criticalMinutes, lastHello: now }, channel: null },
  ])
  return 'iniciado'
}
