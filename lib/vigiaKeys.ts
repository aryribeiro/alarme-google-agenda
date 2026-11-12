// Identidade e sigilo do vigia de push. Só roda no servidor (rotas e steps), nunca no corpo do workflow.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'

const TOKEN_PREFIX = 'vigia:'

/** Identificador do usuário que não revela o e-mail e não pode ser adivinhado sem o segredo do servidor. */
export function userKeyFor(email: string, secret: string): string {
  return createHmac('sha256', secret).update(`vigia-user:${email.toLowerCase()}`).digest('hex').slice(0, 40)
}

export function hookTokenFor(userKey: string): string {
  return `${TOKEN_PREFIX}${userKey}`
}

export function isHookToken(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^vigia:[0-9a-f]{40}$/.test(value)
}

function encryptionKey(secret: string): Buffer {
  return createHash('sha256').update(`vigia-enc:${secret}`).digest()
}

/** AES-256-GCM. O refresh token do Google nunca fica em claro no estado do workflow. */
export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')
}

export function decryptSecret(encoded: string, secret: string): string {
  const raw = Buffer.from(encoded, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
}
