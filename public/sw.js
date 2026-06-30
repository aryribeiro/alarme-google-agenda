self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ALARM') {
    const { title, body, tag, url, level } = event.data

    const isUrgent = level === 'critical' || level === 'maximum'

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag: isUrgent ? `${tag}-${Date.now()}` : tag,
        icon: '/som/logo.png',
        badge: '/som/logo.png',
        vibrate: isUrgent
          ? [300, 100, 300, 100, 300, 100, 300, 100, 300]
          : [200, 100, 200, 100, 200],
        requireInteraction: true,
        renotify: true,
        silent: false,
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
