import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { markChanged, checkChanged } from '@/lib/webhookStore'

export async function POST(request: Request) {
  const resourceState = request.headers.get('x-goog-resource-state')
  const channelToken = request.headers.get('x-goog-channel-token')

  if (resourceState === 'exists' && channelToken) {
    markChanged(channelToken)
  }

  return new Response(null, { status: 200 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ changed: false })
  }

  return NextResponse.json({ changed: checkChanged(session.user.email) })
}
