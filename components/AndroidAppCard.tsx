'use client'

import { useEffect, useState } from 'react'

const APK_URL = 'https://github.com/aryribeiro/alarme-google-agenda/releases/download/android/alarme-agenda.apk'

/** Só no Android: oferece o app que toca o alarme com a tela apagada. No PC não aparece. */
export function AndroidAppCard() {
  const [isAndroid, setIsAndroid] = useState(false)
  const [showSteps, setShowSteps] = useState(false)

  useEffect(() => {
    setIsAndroid(/Android/i.test(navigator.userAgent))
  }, [])

  if (!isAndroid) return null

  return (
    <div className="mb-4 rounded-xl border border-accent-red/40 bg-bg-card p-4">
      <p className="text-sm font-bold text-text-primary">⏰ Alarme com a tela apagada</p>
      <p className="mt-1 text-xs text-text-muted">
        O navegador do celular não deixa um site tocar alarme com a tela apagada. Instale o app Alarme Agenda:
        ele toca como despertador antes e na hora de cada reunião.
      </p>

      <a
        href={APK_URL}
        onClick={() => setShowSteps(true)}
        className="mt-3 flex items-center justify-center rounded-lg bg-accent-red px-4 py-3 text-sm font-bold text-white"
      >
        Baixar o app para Android
      </a>

      {showSteps && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-text-muted">
          <li>Quando o download terminar, toque no arquivo <b>alarme-agenda.apk</b>.</li>
          <li>Se o celular pedir, permita <b>instalar apps desta fonte</b> e volte.</li>
          <li>Toque em <b>Instalar</b> e depois em <b>Abrir</b>.</li>
          <li>No app, toque em cada botão laranja até aparecer <b>Tudo pronto</b>.</li>
          <li>Toque em <b>Testar o alarme agora</b> para conferir o som.</li>
        </ol>
      )}
    </div>
  )
}
