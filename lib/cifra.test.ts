import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from './cifra'

const SEGREDO = 'segredo-de-teste-1'

describe('cifra', () => {
  it('cifra e decifra; o texto cifrado muda a cada vez e não contém o original', () => {
    const cifrado = encryptSecret('refresh-token-123', SEGREDO)
    expect(cifrado).not.toContain('refresh-token-123')
    expect(cifrado).not.toBe(encryptSecret('refresh-token-123', SEGREDO))
    expect(decryptSecret(cifrado, SEGREDO)).toBe('refresh-token-123')
  })

  it('recusa decifrar com outro segredo ou conteúdo adulterado', () => {
    const cifrado = encryptSecret('refresh-token-123', SEGREDO)
    expect(() => decryptSecret(cifrado, 'outro-segredo')).toThrow()
    const adulterado = cifrado.slice(0, -4) + (cifrado.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(() => decryptSecret(adulterado, SEGREDO)).toThrow()
  })
})
