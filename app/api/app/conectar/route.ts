import { getToken } from 'next-auth/jwt'
import { NextResponse, type NextRequest } from 'next/server'
import { criarTokenApp, desafioValido } from '@/lib/appToken'

const PACOTE = 'br.com.aryribeiro.alarmeagenda'
const COOKIES_SESSAO = ['next-auth.session-token', '__Secure-next-auth.session-token']

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Volta do login do Google aberto pelo app: transforma a sessão em credencial do app
 * e devolve ao app por um link que só o pacote do app recebe (intent com package).
 */
export async function GET(request: NextRequest) {
  const desafio = request.nextUrl.searchParams.get('c')
  if (!desafioValido(desafio)) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  const secret = process.env.NEXTAUTH_SECRET
  const jwt = await getToken({ req: request })
  if (!secret || !jwt?.email || !jwt.refreshToken || jwt.error) {
    return NextResponse.redirect(new URL(`/app/entrar?c=${desafio}`, request.url))
  }

  const token = criarTokenApp({ email: jwt.email, refreshToken: jwt.refreshToken }, desafio, secret)
  const destino = `intent://conectado?t=${token}#Intent;scheme=alarmeagenda;package=${PACOTE};end`
  const conta = escaparHtml(jwt.email)

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Alarme Agenda</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A0A0F;color:#F5F5F5;font-family:system-ui,sans-serif;text-align:center;padding:24px}
a{display:block;margin-top:24px;padding:16px;border-radius:12px;background:#00C853;color:#0A0A0F;font-weight:700;text-decoration:none}p{color:#9E9E9E}</style></head>
<body><div><h1>Conta conectada</h1><p>${conta}</p><a href="${destino}">Voltar para o app</a></div>
<script>location.replace(${JSON.stringify(destino)})</script></body></html>`

  const resposta = new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
  // No celular o site não usa login: a sessão aberta só para conectar o app não fica no navegador
  for (const nome of COOKIES_SESSAO) resposta.cookies.delete(nome)
  return resposta
}
