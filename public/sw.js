self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ALARM') {
    const { title, body, tag, url } = event.data

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag,
        icon: '/som/logo.png',
        badge: '/som/logo.png',
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        requireInteraction: true,
        renotify: true,
        data: { url },
      })
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
