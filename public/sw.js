self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// --- Pre-scheduled alarms (background reliability) ---

let scheduledAlarms = []
let loopActive = false

function fireNotification(alarm) {
  const isUrgent = alarm.level === 'critical' || alarm.level === 'maximum'

  self.registration.showNotification(alarm.title, {
    body: alarm.body,
    tag: isUrgent ? `${alarm.tag}-${Date.now()}` : alarm.tag,
    icon: '/som/logo.png',
    badge: '/som/logo.png',
    vibrate: isUrgent
      ? [300, 100, 300, 100, 300, 100, 300, 100, 300]
      : [200, 100, 200, 100, 200],
    requireInteraction: true,
    renotify: true,
    silent: false,
    data: { url: alarm.url },
  })
}

async function processAlarms() {
  loopActive = true
  try {
    while (scheduledAlarms.length > 0) {
      await new Promise((r) => setTimeout(r, 10000))

      const now = Date.now()
      const remaining = []
      const toAdd = []

      for (const alarm of scheduledAlarms) {
        if (now >= alarm.fireAt) {
          fireNotification(alarm)
          if (alarm.level === 'critical' || alarm.level === 'maximum') {
            toAdd.push({ ...alarm, fireAt: now + 30000 })
          }
        } else {
          remaining.push(alarm)
        }
      }

      scheduledAlarms = [...remaining, ...toAdd]
    }
  } finally {
    loopActive = false
  }
}

// --- Message handler ---

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_ALARMS') {
    scheduledAlarms = event.data.alarms || []
    if (scheduledAlarms.length > 0) {
      if (!loopActive) {
        event.waitUntil(processAlarms())
      } else {
        event.waitUntil(
          new Promise((resolve) => {
            const check = setInterval(() => {
              if (!loopActive) { clearInterval(check); resolve() }
            }, 5000)
          })
        )
      }
    }
    return
  }

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
