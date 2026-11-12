import { isHookToken } from '@/lib/vigiaKeys'
import { signalVigia } from '@/lib/vigiaClient'

// O Google manda um aviso por alteração; uma rajada vira um sinal só (melhor esforço, por instância)
const THROTTLE_MS = 10_000
const lastSignal = new Map<string, number>()

function shouldSignal(token: string, now: number): boolean {
  const last = lastSignal.get(token) ?? 0
  if (now - last < THROTTLE_MS) return false
  lastSignal.set(token, now)
  return true
}

/**
 * Aviso de mudança da Calendar API (events.watch). Chega sem corpo e sem login:
 * a autenticação é o token do canal, derivado do segredo do servidor.
 * Sempre responde 200: qualquer outro código faz o Google tratar como falha.
 */
export async function POST(request: Request) {
  const state = request.headers.get('x-goog-resource-state')
  const token = request.headers.get('x-goog-channel-token')

  if (state === 'exists' && isHookToken(token) && shouldSignal(token, Date.now())) {
    await signalVigia(token, { type: 'changed' }).catch((error) => {
      console.error('[webhook] falha ao acordar o vigia:', error instanceof Error ? error.message : 'erro desconhecido')
    })
  }

  return new Response(null, { status: 200 })
}
