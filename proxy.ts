import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: [
    // Ficam fora do filtro de login:
    // - sw.js, timerWorker.js, manifest.json: públicos; redirecioná-los para /login os quebra calados
    // - api/calendar/webhook: quem chama é o Google, sem sessão (autentica pelo token do canal)
    // - .well-known/workflow/: chamadas internas do Workflows
    '/((?!login|admin|api/auth|api/calendar/webhook|\\.well-known/workflow/|_next/static|_next/image|som|favicon.ico|sw.js|timerWorker.js|manifest.json).*)',
  ],
}
