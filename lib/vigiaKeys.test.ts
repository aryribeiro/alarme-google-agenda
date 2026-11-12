import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret, hookTokenFor, isHookToken, userKeyFor } from './vigiaKeys'

const SEGREDO = 'segredo-de-teste-1'

describe('vigiaKeys', () => {
  it('a chave do usuário é estável, depende do segredo e não revela o e-mail', () => {
    const a = userKeyFor('ana@exemplo.com', SEGREDO)
    expect(a).toBe(userKeyFor('ana@exemplo.com', SEGREDO))
    expect(a).toBe(userKeyFor('Ana@Exemplo.com', SEGREDO))
    expect(a).not.toBe(userKeyFor('ana@exemplo.com', 'outro-segredo'))
    expect(a).not.toBe(userKeyFor('bia@exemplo.com', SEGREDO))
    expect(a).toMatch(/^[0-9a-f]{40}$/)
  })

  it('reconhece só tokens no formato do vigia', () => {
    const token = hookTokenFor(userKeyFor('ana@exemplo.com', SEGREDO))
    expect(isHookToken(token)).toBe(true)
    expect(isHookToken('vigia:ana@exemplo.com')).toBe(false)
    expect(isHookToken('ana@exemplo.com')).toBe(false)
    expect(isHookToken(null)).toBe(false)
  })

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
