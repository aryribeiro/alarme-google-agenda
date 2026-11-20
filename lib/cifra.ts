// Cifra simétrica do servidor (AES-256-GCM com chave derivada do NEXTAUTH_SECRET). Só servidor.
// Usada na credencial do app Android: a conta Google nunca fica em claro fora do servidor.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function encryptionKey(secret: string): Buffer {
  // O rótulo antigo ("vigia-enc") fica: trocá-lo invalidaria as credenciais já entregues aos aparelhos
  return createHash('sha256').update(`vigia-enc:${secret}`).digest()
}

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
