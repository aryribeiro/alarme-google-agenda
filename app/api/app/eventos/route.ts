import { NextResponse } from 'next/server'
import { lerTokenApp, TokenAppInvalido } from '@/lib/appToken'
import { fetchRooms } from '@/lib/googleCalendar'
import { InvalidGrantError, listAppEvents, refreshAccessToken } from '@/lib/vigiaGoogle'

const SEM_CACHE = { 'Cache-Control': 'no-store' }

function reconectar() {
  // O app mostra "Entrar com Google" de novo
  return NextResponse.json({ codigo: 'reconectar' }, { status: 401, headers: SEM_CACHE })
}

/** Reuniões da conta do site para o app Android (próximas 24 h) e as salas do menu. */
export async function GET(request: Request) {
  const secret = process.env.NEXTAUTH_SECRET
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!secret || !clientId || !clientSecret) return NextResponse.json({ codigo: 'configuracao' }, { status: 500 })

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const verificador = request.headers.get('x-verificador') ?? ''

  try {
    const sessao = lerTokenApp(token, verificador, secret)
    const accessToken = await refreshAccessToken(sessao.refreshToken, { clientId, clientSecret })
    const [eventos, salas] = await Promise.all([
      listAppEvents(accessToken, Date.now()),
      fetchRooms(accessToken).catch(() => []),
    ])
    return NextResponse.json(
      { conta: sessao.email, eventos, salas: salas.map((s) => ({ nome: s.name, url: s.url })) },
      { headers: SEM_CACHE },
    )
  } catch (error) {
    if (error instanceof TokenAppInvalido || error instanceof InvalidGrantError) return reconectar()
    console.error('[app/eventos]', error instanceof Error ? error.message : 'erro desconhecido')
    return NextResponse.json({ codigo: 'indisponivel' }, { status: 503, headers: SEM_CACHE })
  }
}
