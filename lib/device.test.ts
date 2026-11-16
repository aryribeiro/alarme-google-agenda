import { describe, expect, it } from 'vitest'
import { isPhone, rotaPara } from './device'

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; moto g84 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const PC_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0'
const PC_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

describe('isPhone', () => {
  it('reconhece celular Android e iPhone', () => {
    expect(isPhone(ANDROID)).toBe(true)
    expect(isPhone(IPHONE)).toBe(true)
  })

  it('PC e tablet não são celular', () => {
    expect(isPhone(PC_FIREFOX)).toBe(false)
    expect(isPhone(PC_CHROME)).toBe(false)
    expect(isPhone(ANDROID_TABLET)).toBe(false)
    expect(isPhone('')).toBe(false)
  })
})

describe('rotaPara', () => {
  it('no celular, toda página vira a página informativa', () => {
    for (const path of ['/', '/login', '/admin', '/qualquer']) {
      expect(rotaPara(path, ANDROID)).toBe('celular')
      expect(rotaPara(path, IPHONE)).toBe('celular')
    }
  })

  it('no celular, a própria página informativa e o login do app passam', () => {
    expect(rotaPara('/celular', ANDROID)).toBe('livre')
    expect(rotaPara('/app/entrar', ANDROID)).toBe('livre')
  })

  it('no celular, as APIs seguem a regra de login de sempre (não viram página)', () => {
    expect(rotaPara('/api/calendar/events', ANDROID)).toBe('login')
  })

  it('no PC nada muda: login e admin livres, o resto exige login', () => {
    expect(rotaPara('/', PC_FIREFOX)).toBe('login')
    expect(rotaPara('/login', PC_FIREFOX)).toBe('livre')
    expect(rotaPara('/admin', PC_CHROME)).toBe('livre')
    expect(rotaPara('/celular', PC_CHROME)).toBe('livre')
    expect(rotaPara('/api/presence', PC_CHROME)).toBe('login')
  })
})
