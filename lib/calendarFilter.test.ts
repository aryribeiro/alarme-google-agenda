import { describe, expect, it } from 'vitest'
import { isAlarmableEvent } from './calendarFilter'

const reuniao = { id: 'e1', status: 'confirmed', start: { dateTime: '2026-11-12T15:00:00-03:00' } }

describe('isAlarmableEvent', () => {
  it('reunião com horário marcado dispara alarme', () => {
    expect(isAlarmableEvent(reuniao)).toBe(true)
    expect(isAlarmableEvent({ ...reuniao, eventType: 'default' })).toBe(true)
  })

  it('evento de dia inteiro (sem horário) não dispara', () => {
    expect(isAlarmableEvent({ id: 'e2', start: { date: '2026-11-12' } })).toBe(false)
    expect(isAlarmableEvent({ id: 'e3' })).toBe(false)
  })

  it('evento cancelado não dispara', () => {
    expect(isAlarmableEvent({ ...reuniao, status: 'cancelled' })).toBe(false)
  })

  it('convite recusado por mim não dispara; aceito ou sem resposta dispara', () => {
    const com = (responseStatus: string) => ({ ...reuniao, attendees: [{ self: true, responseStatus }, { responseStatus: 'declined' }] })
    expect(isAlarmableEvent(com('declined'))).toBe(false)
    expect(isAlarmableEvent(com('accepted'))).toBe(true)
    expect(isAlarmableEvent(com('needsAction'))).toBe(true)
  })

  it('recusa de outro participante não me afeta', () => {
    expect(isAlarmableEvent({ ...reuniao, attendees: [{ responseStatus: 'declined' }] })).toBe(true)
  })

  it('"fora do escritório" e "local de trabalho" não são reunião', () => {
    expect(isAlarmableEvent({ ...reuniao, eventType: 'outOfOffice' })).toBe(false)
    expect(isAlarmableEvent({ ...reuniao, eventType: 'workingLocation' })).toBe(false)
    expect(isAlarmableEvent({ ...reuniao, eventType: 'focusTime' })).toBe(true)
  })
})
