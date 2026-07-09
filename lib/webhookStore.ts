const notifications = new Map<string, number>()

export function markChanged(userToken: string): void {
  notifications.set(userToken, Date.now())
}

export function checkChanged(userToken: string): boolean {
  const ts = notifications.get(userToken)
  if (!ts) return false
  notifications.delete(userToken)
  return Date.now() - ts < 5 * 60 * 1000
}
