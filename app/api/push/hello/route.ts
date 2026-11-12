import { NextResponse, type NextRequest } from 'next/server'
import { parseCriticalMinutes, parsePushSubscription } from '@/lib/pushSubscription'
import { getVigiaIdentity, helloVigia } from '@/lib/vigiaClient'

/** O app abriu neste aparelho: registra o aparelho e garante que o vigia do usuário está de pé. */
export async function POST(request: NextRequest) {
  const identity = await getVigiaIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const sub = parsePushSubscription(body?.subscription)
  if (!sub) return NextResponse.json({ error: 'Aparelho inválido' }, { status: 400 })

  try {
    const vigia = await helloVigia(identity, sub, parseCriticalMinutes(body?.criticalMinutes))
    return NextResponse.json({ vigia })
  } catch (error) {
    console.error('[push/hello]', error instanceof Error ? error.message : 'erro desconhecido')
    return NextResponse.json({ error: 'Não foi possível ativar os avisos agora' }, { status: 503 })
  }
}
