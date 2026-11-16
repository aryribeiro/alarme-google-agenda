import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware'
import { rotaPara } from '@/lib/device'

const comLogin = withAuth({
  pages: {
    signIn: '/login',
  },
})

/** No celular toda página vira /celular (o alarme ali é o app Android); no PC, o login de sempre. */
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const rota = rotaPara(request.nextUrl.pathname, request.headers.get('user-agent') ?? '')
  if (rota === 'celular') return NextResponse.rewrite(new URL('/celular', request.url))
  if (rota === 'livre') return NextResponse.next()
  return comLogin(request as NextRequestWithAuth, event)
}

export const config = {
  matcher: [
    // Ficam fora deste filtro:
    // - sw.js, timerWorker.js, manifest.json, som/: públicos; redirecioná-los para /login os quebra calados
    // - api/auth: o próprio login
    // - api/calendar/webhook: quem chama é o Google, sem sessão (autentica pelo token do canal)
    // - api/app: o app Android, autenticado pelo token do app
    // - .well-known/workflow/: chamadas internas do Workflows
    '/((?!api/auth|api/calendar/webhook|api/app|\\.well-known/workflow/|_next/static|_next/image|som|favicon.ico|sw.js|timerWorker.js|manifest.json).*)',
  ],
}
