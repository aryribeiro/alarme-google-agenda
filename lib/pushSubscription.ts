// Validação, na borda, do que o navegador manda ao registrar o aparelho para push.
import type { PushSub } from './pushPlan'

// O servidor faz POST no endpoint informado: só os serviços de push dos navegadores são aceitos
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']
const KEY_FORMAT = /^[A-Za-z0-9_\-+/=]{1,300}$/
const DEFAULT_CRITICAL_MINUTES = 5

function isPushHost(hostname: string): boolean {
  return PUSH_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
}

function parseEndpoint(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && isPushHost(url.hostname) ? value : null
  } catch {
    return null
  }
}

function isKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_FORMAT.test(value)
}

export function parsePushSubscription(body: unknown): PushSub | null {
  if (typeof body !== 'object' || body === null) return null
  const { endpoint, keys } = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }

  const validEndpoint = parseEndpoint(endpoint)
  if (!validEndpoint || !isKey(keys?.p256dh) || !isKey(keys?.auth)) return null
  return { endpoint: validEndpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }
}

export function parseCriticalMinutes(value: unknown): number {
  const valid = typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 60
  return valid ? value : DEFAULT_CRITICAL_MINUTES
}
