import { describe, expect, it } from 'vitest'
import { criarTokenApp, desafioDe, desafioValido, lerTokenApp, TokenAppInvalido } from './appToken'

const SEGREDO = 'segredo-de-teste-1'
const VERIFICADOR = 'v'.repeat(20) + 'erificador-aleatorio-do-app-123'
const sessao = { email: 'ana@empresa.com.br', refreshToken: 'refresh-123' }

describe('token do app', () => {
  it('o desafio é o SHA-256 do verificador em base64url (43 caracteres)', () => {
    const d = desafioDe(VERIFICADOR)
    expect(d).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(desafioValido(d)).toBe(true)
    expect(desafioValido('curto')).toBe(false)
    expect(desafioValido(null)).toBe(false)
  })

  it('ida e volta com o verificador certo devolve a conta', () => {
    const token = criarTokenApp(sessao, desafioDe(VERIFICADOR), SEGREDO)
    expect(lerTokenApp(token, VERIFICADOR, SEGREDO)).toEqual(sessao)
  })

  it('o token vai em URL: só caracteres seguros e sem a credencial em claro', () => {
    const token = criarTokenApp(sessao, desafioDe(VERIFICADOR), SEGREDO)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token).not.toContain('refresh-123')
    expect(token).not.toContain('ana@')
  })

  it('quem interceptar o token sem o verificador não usa', () => {
    const token = criarTokenApp(sessao, desafioDe(VERIFICADOR), SEGREDO)
    expect(() => lerTokenApp(token, 'outro-verificador-qualquer-de-tamanho-ok', SEGREDO)).toThrow(TokenAppInvalido)
  })

  it('recusa token de outro servidor, adulterado ou lixo', () => {
    const token = criarTokenApp(sessao, desafioDe(VERIFICADOR), SEGREDO)
    expect(() => lerTokenApp(token, VERIFICADOR, 'outro-segredo')).toThrow(TokenAppInvalido)
    const adulterado = token.slice(0, -3) + (token.endsWith('AAA') ? 'BBB' : 'AAA')
    expect(() => lerTokenApp(adulterado, VERIFICADOR, SEGREDO)).toThrow(TokenAppInvalido)
    expect(() => lerTokenApp('lixo', VERIFICADOR, SEGREDO)).toThrow(TokenAppInvalido)
    expect(() => lerTokenApp('', VERIFICADOR, SEGREDO)).toThrow(TokenAppInvalido)
  })
})
