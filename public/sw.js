self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// A etiqueta é a reunião: um aviso novo substitui o anterior da mesma reunião em vez de empilhar
function showAlarm(alarm) {
  const isUrgent = alarm.level === 'critical' || alarm.level === 'maximum'

  return self.registration.showNotification(alarm.title || 'Alarme Google Agenda', {
    body: alarm.body || '',
    tag: alarm.tag || 'alarme',
    icon: '/som/logo.png',
    badge: '/som/logo.png',
    vibrate: isUrgent
      ? [300, 100, 300, 100, 300, 100, 300, 100, 300]
      : [200, 100, 200, 100, 200],
    requireInteraction: true,
    renotify: true,
    silent: false,
    actions: [
      { action: 'open', title: 'Entrar na Reunião' }
    ],
    data: { url: alarm.url || '/' },
  })
}

// Aviso enviado pelo servidor (vigia): chega com a tela apagada e o navegador fechado
self.addEventListener('push', (event) => {
  let alarm = {}
  try {
    alarm = event.data ? event.data.json() : {}
  } catch {
    // corpo ilegível: ainda assim mostra um aviso genérico (o navegador exige notificação a cada push)
  }
  event.waitUntil(showAlarm(alarm))
})

// Aviso pedido pela página aberta
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ALARM') {
    event.waitUntil(showAlarm(event.data))
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'
  const isMeetingLink = /^https?:\/\//.test(url) && !url.startsWith(self.location.origin)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Link de reunião abre direto; sem link, volta para o app
      if (isMeetingLink) return self.clients.openWindow(url)
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
