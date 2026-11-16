// Decide, pelo navegador que pediu a página, se ela é servida normalmente ou trocada pela página do celular.
// No celular o alarme é o app Android; o site ali só informa (não pede login nem mostra reuniões).

// Celular: Android com "Mobile" (tablet Android não traz) e iPhone/iPod
const PHONE = /\bAndroid\b.*\bMobile\b|\biPhone\b|\biPod\b/i

// Páginas abertas sem login no PC
const PUBLICAS = ['/login', '/admin', '/celular', '/app/entrar']

// No celular só estas passam: a própria página informativa e o login disparado pelo app
const PUBLICAS_CELULAR = ['/celular', '/app/entrar']

export type Rota = 'celular' | 'livre' | 'login'

export function isPhone(userAgent: string): boolean {
  return PHONE.test(userAgent)
}

export function rotaPara(path: string, userAgent: string): Rota {
  // API nunca vira página: segue a regra de login de sempre
  if (path.startsWith('/api/')) return 'login'
  if (isPhone(userAgent)) return PUBLICAS_CELULAR.includes(path) ? 'livre' : 'celular'
  return PUBLICAS.includes(path) ? 'livre' : 'login'
}
