import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const heartbeats = new Map<string, number>()

const WINDOW_MS = 5 * 60 * 1000

function getOnlineCount(): number {
  const now = Date.now()
  let count = 0
  heartbeats.forEach((timestamp, key) => {
    if (now - timestamp > WINDOW_MS) {
      heartbeats.delete(key)
    } else {
      count++
    }
  })
  return count
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  heartbeats.set(session.user.email, Date.now())
  return NextResponse.json({ online: getOnlineCount() })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  return NextResponse.json({ online: getOnlineCount() })
}
