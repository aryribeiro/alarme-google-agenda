import { NextResponse, type NextRequest } from 'next/server'
import { getVigiaIdentity, signalVigia } from '@/lib/vigiaClient'

/** Saída da conta neste aparelho: ele deixa de receber avisos. */
export async function POST(request: NextRequest) {
  const identity = await getVigiaIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const endpoint = body?.endpoint
  if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > 2048) {
    return NextResponse.json({ error: 'Aparelho inválido' }, { status: 400 })
  }

  try {
    const delivered = await signalVigia(identity.token, { type: 'unsubscribe', endpoint })
    return NextResponse.json({ delivered })
  } catch (error) {
    console.error('[push/unsubscribe]', error instanceof Error ? error.message : 'erro desconhecido')
    return NextResponse.json({ error: 'Não foi possível desativar no servidor' }, { status: 503 })
  }
}
