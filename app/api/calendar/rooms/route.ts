import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fetchRooms } from '@/lib/googleCalendar'
import { parseGoogleError } from '@/lib/googleErrors'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Não autenticado', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      )
    }

    if (session.error === 'RefreshAccessTokenError') {
      return NextResponse.json(
        { error: 'Token expirado. Faça login novamente.', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      )
    }

    const rooms = await fetchRooms(session.accessToken)
    return NextResponse.json(rooms)
  } catch (err) {
    const parsed = parseGoogleError(err)
    return NextResponse.json(
      { error: parsed.message, code: parsed.code },
      { status: parsed.status || 500 }
    )
  }
}
