import { DEFAULT_CONFIG } from '@/types'
import type { AdminConfig } from '@/types'

const STORAGE_KEY = 'alarme-agenda-config'
const ADMIN_SESSION_KEY = 'alarme-admin-session'

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const config = getAdminConfig()
  const hash = await hashPassword(password)
  return hash === config.adminPasswordHash
}

export function setAdminSession(): void {
  const expires = Date.now() + 24 * 60 * 60 * 1000
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ expires }))
}

export function isAdminSessionValid(): boolean {
  const stored = localStorage.getItem(ADMIN_SESSION_KEY)
  if (!stored) return false
  try {
    const { expires } = JSON.parse(stored)
    return Date.now() < expires
  } catch {
    return false
  }
}

export function clearAdminSession(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY)
}

export function getAdminConfig(): AdminConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return DEFAULT_CONFIG
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(stored) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveAdminConfig(config: Partial<AdminConfig>): void {
  const current = getAdminConfig()
  const updated = { ...current, ...config }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function resetAdminConfig(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG))
}
