import { headers } from 'next/headers'

export const metadata = { title: 'Alarme Google Agenda 2026 — no celular, use o app' }

const APK_URL = 'https://github.com/aryribeiro/alarme-google-agenda/releases/download/android/alarme-agenda.apk'
// Abre o app se estiver instalado; se não estiver, o Chrome baixa o APK
const ABRIR_APP = `intent://abrir#Intent;scheme=alarmeagenda;package=br.com.aryribeiro.alarmeagenda;S.browser_fallback_url=${encodeURIComponent(APK_URL)};end`

/** No celular o site só informa: o alarme com a tela apagada é o app Android. */
export default async function CelularPage() {
  const ua = (await headers()).get('user-agent') ?? ''
  const android = /Android/i.test(ua)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <img src="/som/logo.png" alt="Logo" className="mx-auto mb-4 h-16 w-auto" />
          <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">Alarme Google Agenda 2026</h1>
          <span className="mt-3 inline-block rounded-full border border-accent-orange/50 px-3 py-1 text-xs font-semibold text-accent-orange">
            Você está no navegador do celular
          </span>
        </div>

        {android ? (
          <>
            <p className="text-sm text-text-muted">
              No celular, o alarme funciona pelo <b className="text-text-primary">app Alarme Agenda</b>: ele toca como
              despertador antes e na hora de cada reunião, mesmo com a tela apagada.
              <br />
              <b className="text-text-primary">Feche este navegador e use o app.</b>
            </p>

            <a href={ABRIR_APP} className="block w-full rounded-xl bg-accent-green px-6 py-4 text-base font-bold text-bg-primary">
              Abrir o app
            </a>

            <div className="rounded-xl border border-border bg-bg-card p-4 text-left">
              <p className="text-sm font-semibold text-text-primary">Ainda não instalou?</p>
              <a href={APK_URL} className="mt-3 block rounded-lg bg-accent-red px-4 py-3 text-center text-sm font-bold text-white">
                Baixar o app para Android
              </a>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-text-muted">
                <li>Toque no arquivo <b>alarme-agenda.apk</b> quando o download terminar.</li>
                <li>Se o celular pedir, permita <b>instalar apps desta fonte</b> e volte.</li>
                <li>Toque em <b>Instalar</b> e depois em <b>Abrir</b>.</li>
                <li>No app, toque em <b>Entrar com Google</b> com a <b>mesma conta da empresa</b> que você usa no computador.</li>
              </ol>
            </div>
          </>
        ) : (
          <p className="text-sm text-text-muted">
            O alarme não funciona pelo navegador do celular. Há app apenas para Android; no iPhone, use o Alarme Google
            Agenda no computador.
          </p>
        )}

        <p className="text-xs text-text-muted">No computador, continue usando o site normalmente.</p>
      </div>

      <footer className="mt-10 text-center">
        <p className="text-[10px] italic text-text-muted/50">
          por{' '}
          <a href="https://www.linkedin.com/in/aryribeiro" target="_blank" rel="noopener noreferrer" className="font-bold hover:text-text-muted">
            Ary Ribeiro
          </a>
        </p>
      </footer>
    </div>
  )
}
