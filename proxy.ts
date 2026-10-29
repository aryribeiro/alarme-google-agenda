import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: [
    // sw.js, timerWorker.js e manifest.json são públicos: redirecionar o service worker ou o worker para /login os quebra calados
    '/((?!login|admin|api/auth|_next/static|_next/image|som|favicon.ico|sw.js|timerWorker.js|manifest.json).*)',
  ],
}
