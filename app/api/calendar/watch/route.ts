import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { watchCalendar } from '@/lib/googleCalendar'
import { parseGoogleError } from '@/lib/googleErrors'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken || !session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const baseUrl = process.env.NEXTAUTH_URL
    if (!baseUrl?.startsWith('https://')) {
      return NextResponse.json(
        { error: 'NEXTAUTH_URL deve ser HTTPS para push notifications' },
        { status: 400 }
      )
    }

    const webhookUrl = `${baseUrl}/api/calendar/webhook`
    const result = await watchCalendar(session.accessToken, webhookUrl, session.user.email)

    return NextResponse.json(result)
  } catch (err) {
    const parsed = parseGoogleError(err)
    return NextResponse.json(
      { error: parsed.message, code: parsed.code },
      { status: parsed.status || 500 }
    )
  }
}
