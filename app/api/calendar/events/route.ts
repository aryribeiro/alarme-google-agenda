import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fetchUpcomingEvents } from '@/lib/googleCalendar'
import { parseGoogleError } from '@/lib/googleErrors'

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const syncToken = searchParams.get('syncToken') || undefined

    const result = await fetchUpcomingEvents(session.accessToken, syncToken)
    return NextResponse.json(result)
  } catch (err) {
    const parsed = parseGoogleError(err)
    return NextResponse.json(
      {
        error: parsed.message,
        code: parsed.code,
        retryable: parsed.retryable,
        retryAfterMs: parsed.retryAfterMs,
      },
      { status: parsed.status || 500 }
    )
  }
}
