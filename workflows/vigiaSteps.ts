// Steps do vigia: única parte com rede e segredos. O corpo do workflow só orquestra.
import { randomUUID } from 'node:crypto'
import { resumeHook } from 'workflow/api'
import { HookNotFoundError } from 'workflow/errors'
import type { Signal, WatchState } from '../lib/pushPlan'
import { ensureWatchChannel, listUpcomingEvents, refreshAccessToken, type WatchChannel } from '../lib/vigiaGoogle'
import { decryptSecret, hookTokenFor } from '../lib/vigiaKeys'
import { createVapidSender } from '../lib/vigiaPush'
import { runTick, type TickDeps, type TickResult } from '../lib/vigiaTick'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`variável de ambiente ausente: ${name}`)
  return value
}

function realDeps(userKey: string): TickDeps {
  const secret = requireEnv('NEXTAUTH_SECRET')
  const baseUrl = requireEnv('NEXTAUTH_URL').replace(/\/$/, '')
  const google = { clientId: requireEnv('GOOGLE_CLIENT_ID'), clientSecret: requireEnv('GOOGLE_CLIENT_SECRET') }
  const send = createVapidSender({
    // O serviço de push exige https: ou mailto: aqui; VAPID_SUBJECT só é preciso quando o app roda em http (local)
    subject: process.env.VAPID_SUBJECT || baseUrl,
    publicKey: requireEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY'),
    privateKey: requireEnv('VAPID_PRIVATE_KEY'),
  })

  return {
    getAccessToken: (enc) => refreshAccessToken(decryptSecret(enc, secret), google),
    listEvents: (accessToken, now) => listUpcomingEvents(accessToken, now),
    ensureChannel: (accessToken, channel, now) =>
      ensureWatchChannel({
        accessToken,
        channel,
        now,
        address: `${baseUrl}/api/calendar/webhook`,
        token: hookTokenFor(userKey),
        channelId: randomUUID(),
      }),
    send,
  }
}

export async function tick(state: WatchState, channel: WatchChannel | null, errors: number): Promise<TickResult> {
  'use step'
  const now = Date.now()
  try {
    return await runTick({ state, channel, errors, now }, realDeps(state.userKey))
  } catch (error) {
    // Configuração quebrada (variável ausente): não derruba o vigia, tenta de novo depois
    console.error('[vigia] configuração:', error instanceof Error ? error.message : 'erro desconhecido')
    return { now, fired: state.fired, subs: state.subs, channel, nextWakeAt: now + 30 * 60_000, errors: errors + 1 }
  }
}

/** Entrega um sinal ao vigia que hoje é dono do token (usado por quem foi substituído). */
export async function forwardSignal(token: string, signal: Signal): Promise<boolean> {
  'use step'
  try {
    await resumeHook(token, signal)
    return true
  } catch (error) {
    if (HookNotFoundError.is(error)) return false
    throw error
  }
}
