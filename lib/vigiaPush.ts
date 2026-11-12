// Envio dos avisos do vigia por Web Push (VAPID). Só servidor.
import { sendNotification } from 'web-push'
import type { DuePush, PushSub } from './pushPlan'

export type SendFn = (sub: PushSub, payload: string) => Promise<void>

// A reunião "agora" insiste: mesma notificação reemitida, o aparelho vibra de novo
const REPEAT_GAP_MS = 5000
// Passado isso o aviso perdeu o sentido; melhor não entregar do que entregar tarde
const TTL_SECONDS = 600

export function createVapidSender(vapid: { subject: string; publicKey: string; privateKey: string }): SendFn {
  return async (sub, payload) => {
    await sendNotification(sub, payload, {
      TTL: TTL_SECONDS,
      urgency: 'high',
      vapidDetails: vapid,
    })
  }
}

function isGone(error: unknown): boolean {
  const status = (error as { statusCode?: number })?.statusCode
  return status === 404 || status === 410
}

function failureReason(error: unknown): string {
  const status = (error as { statusCode?: number })?.statusCode
  return status ? `HTTP ${status}` : error instanceof Error ? error.message : 'erro desconhecido'
}

function payloadFor(push: DuePush): string {
  return JSON.stringify({ title: push.title, body: push.body, tag: push.eventId, url: push.url, level: push.kind })
}

async function sendRound(subs: PushSub[], payload: string, send: SendFn): Promise<PushSub[]> {
  const results = await Promise.allSettled(subs.map((sub) => send(sub, payload)))
  // Só sai da lista o aparelho que o serviço de push declarou extinto; falha passageira fica
  return subs.filter((_, i) => {
    const result = results[i]
    if (result.status === 'fulfilled') return true
    // Falha de envio nunca fica calada; só o motivo, sem dado do aparelho
    console.error('[vigia] push falhou:', failureReason(result.reason))
    return !isGone(result.reason)
  })
}

/** Envia os avisos vencidos a todos os aparelhos e devolve os aparelhos que continuam válidos. */
export async function sendDuePushes(
  subs: PushSub[],
  due: DuePush[],
  send: SendFn,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<PushSub[]> {
  let alive = subs
  const rounds = Math.max(0, ...due.map((push) => push.repeat))

  for (let round = 0; round < rounds && alive.length > 0; round++) {
    if (round > 0) await wait(REPEAT_GAP_MS)
    for (const push of due.filter((p) => p.repeat > round)) {
      alive = await sendRound(alive, payloadFor(push), send)
    }
  }
  return alive
}
