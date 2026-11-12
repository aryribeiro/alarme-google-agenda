import { NextResponse, type NextRequest } from 'next/server'
import { getBrtDateString } from '@/lib/brtDate'
import { getVigiaIdentity, signalVigia } from '@/lib/vigiaClient'

/** Reunião silenciada no app: o vigia também para de avisar sobre ela hoje. */
export async function POST(request: NextRequest) {
  const identity = await getVigiaIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const eventId = body?.eventId
  if (typeof eventId !== 'string' || eventId.length === 0 || eventId.length > 1024) {
    return NextResponse.json({ error: 'Reunião inválida' }, { status: 400 })
  }

  try {
    const delivered = await signalVigia(identity.token, { type: 'silence', eventId, day: getBrtDateString() })
    return NextResponse.json({ delivered })
  } catch (error) {
    console.error('[push/silence]', error instanceof Error ? error.message : 'erro desconhecido')
    return NextResponse.json({ error: 'Não foi possível silenciar no servidor' }, { status: 503 })
  }
}
