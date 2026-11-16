// Credencial do app Android: a conta Google do site, cifrada pelo servidor e presa ao aparelho.
// O app guarda o token e um verificador aleatório que só ele conhece; sem o verificador o token não vale.
import { createHash } from 'node:crypto'
import { decryptSecret, encryptSecret } from './vigiaKeys'

export interface AppSession {
  email: string
  refreshToken: string
}

export class TokenAppInvalido extends Error {
  constructor() {
    super('token do app inválido')
    this.name = 'TokenAppInvalido'
  }
}

const VERSAO = 1
const DESAFIO = /^[A-Za-z0-9_-]{43}$/

function paraUrl(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deUrl(texto: string): string {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  return base64 + '='.repeat((4 - (base64.length % 4)) % 4)
}

/** SHA-256 do verificador em base64url: é o que o app manda no login (o verificador fica no aparelho). */
export function desafioDe(verificador: string): string {
  return createHash('sha256').update(verificador).digest('base64url')
}

export function desafioValido(valor: unknown): valor is string {
  return typeof valor === 'string' && DESAFIO.test(valor)
}

export function criarTokenApp(sessao: AppSession, desafio: string, secret: string): string {
  const conteudo = JSON.stringify({ v: VERSAO, e: sessao.email, rt: sessao.refreshToken, c: desafio })
  return paraUrl(encryptSecret(conteudo, secret))
}

export function lerTokenApp(token: string, verificador: string, secret: string): AppSession {
  try {
    const dados = JSON.parse(decryptSecret(deUrl(token), secret)) as { v?: number; e?: string; rt?: string; c?: string }
    if (dados.v !== VERSAO || !dados.e || !dados.rt || dados.c !== desafioDe(verificador)) throw new TokenAppInvalido()
    return { email: dados.e, refreshToken: dados.rt }
  } catch {
    throw new TokenAppInvalido()
  }
}
