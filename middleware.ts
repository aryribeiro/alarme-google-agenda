import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: [
    '/((?!login|admin|api/auth|_next/static|_next/image|som|favicon.ico).*)',
  ],
}
