// Credencial do app Android: a conta Google do site, cifrada pelo servidor e presa ao aparelho.
// O app guarda o token e um verificador aleatório que só ele conhece; sem o verificador o token não vale.
import { createHash } from 'node:crypto'
import { decryptSecret, encryptSecret } from './cifra'

export interface AppSession {
  email: string
  refreshToken: string
}

export interface AppSessionLida extends AppSession {
  emitidoEm: number
}

export class TokenAppInvalido extends Error {
  constructor() {
    super('token do app inválido')
    this.name = 'TokenAppInvalido'
  }
}

const VERSAO = 2
const DESAFIO = /^[A-Za-z0-9_-]{43}$/
const DIA = 24 * 60 * 60 * 1000
// Sem banco não há lista de revogação: a credencial expira sozinha se ficar 30 dias sem uso.
// Em uso, o servidor emite uma nova no máximo uma vez por dia. Revogação imediata: tirar o acesso
// do app na conta Google (vale para tudo) ou trocar o NEXTAUTH_SECRET (derruba todas as credenciais).
const VALIDADE_MS = 30 * DIA
const RENOVAR_APOS_MS = DIA
const FOLGA_RELOGIO_MS = 5 * 60 * 1000

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

export function criarTokenApp(sessao: AppSession, desafio: string, secret: string, agora: number = Date.now()): string {
  const conteudo = JSON.stringify({ v: VERSAO, e: sessao.email, rt: sessao.refreshToken, c: desafio, t: agora })
  return paraUrl(encryptSecret(conteudo, secret))
}

export function lerTokenApp(token: string, verificador: string, secret: string, agora: number = Date.now()): AppSessionLida {
  try {
    const dados = JSON.parse(decryptSecret(deUrl(token), secret)) as { v?: number; e?: string; rt?: string; c?: string; t?: number }
    const valido = dados.v === VERSAO && !!dados.e && !!dados.rt && dados.c === desafioDe(verificador) &&
      typeof dados.t === 'number' && dados.t <= agora + FOLGA_RELOGIO_MS && agora - dados.t <= VALIDADE_MS
    if (!valido) throw new TokenAppInvalido()
    return { email: dados.e as string, refreshToken: dados.rt as string, emitidoEm: dados.t as number }
  } catch {
    throw new TokenAppInvalido()
  }
}

export function precisaRenovar(emitidoEm: number, agora: number = Date.now()): boolean {
  return agora - emitidoEm >= RENOVAR_APOS_MS
}
