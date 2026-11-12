import { describe, expect, it } from 'vitest'
import { parseCriticalMinutes, parsePushSubscription } from './pushSubscription'

const keys = { p256dh: 'BPubKey_-123', auth: 'authSecret_-9' }

describe('parsePushSubscription', () => {
  it('aceita os serviços de push dos navegadores (Chrome, Firefox, Safari, Edge)', () => {
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/abc',
      'https://wns2-by3p.notify.windows.com/w/?token=abc',
    ]) {
      expect(parsePushSubscription({ endpoint, keys })).toEqual({ endpoint, keys })
    }
  })

  it('descarta campos extras', () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/abc'
    expect(parsePushSubscription({ endpoint, keys: { ...keys, extra: 'x' }, expirationTime: null })).toEqual({ endpoint, keys })
  })

  it('recusa endereço fora dos serviços de push (o servidor faria requisição para onde o cliente mandasse)', () => {
    const recusa = (endpoint: unknown) => expect(parsePushSubscription({ endpoint, keys })).toBeNull()
    recusa('https://exemplo.com/push')
    recusa('https://fcm.googleapis.com.exemplo.com/x')
    recusa('https://exemplofcm.googleapis.com/x')
    recusa('http://fcm.googleapis.com/fcm/send/abc')
    recusa('https://169.254.169.254/latest/meta-data')
    recusa('não é url')
    recusa(42)
  })

  it('recusa chaves ausentes, vazias ou fora do formato', () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/abc'
    expect(parsePushSubscription({ endpoint })).toBeNull()
    expect(parsePushSubscription({ endpoint, keys: { p256dh: '', auth: 'a' } })).toBeNull()
    expect(parsePushSubscription({ endpoint, keys: { p256dh: 'ok', auth: 'com espaço' } })).toBeNull()
    expect(parsePushSubscription({ endpoint, keys: { p256dh: 'x'.repeat(301), auth: 'a' } })).toBeNull()
    expect(parsePushSubscription(null)).toBeNull()
    expect(parsePushSubscription('texto')).toBeNull()
  })
})

describe('parseCriticalMinutes', () => {
  it('aceita inteiro de 1 a 60; fora disso usa 5', () => {
    expect(parseCriticalMinutes(10)).toBe(10)
    expect(parseCriticalMinutes(1)).toBe(1)
    expect(parseCriticalMinutes(60)).toBe(60)
    expect(parseCriticalMinutes(0)).toBe(5)
    expect(parseCriticalMinutes(61)).toBe(5)
    expect(parseCriticalMinutes(2.5)).toBe(5)
    expect(parseCriticalMinutes('10')).toBe(5)
    expect(parseCriticalMinutes(undefined)).toBe(5)
  })
})
