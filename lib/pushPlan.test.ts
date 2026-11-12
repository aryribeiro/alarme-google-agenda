import { describe, expect, it } from 'vitest'
import { applySignal, planPushes, shouldStop, type WatchState } from './pushPlan'

const MIN = 60_000
const HOUR = 60 * MIN
// 12/11/2026 15:00 BRT = 18:00 UTC
const START = Date.UTC(2026, 10, 12, 18, 0, 0)
const reuniao = { id: 'ev1', summary: 'Daily', start: new Date(START).toISOString() }

function plan(now: number, extra: Partial<Parameters<typeof planPushes>[0]> = {}) {
  return planPushes({ events: [reuniao], now, fired: [], silencedIds: [], criticalMinutes: 5, resyncMs: 3 * HOUR, ...extra })
}

describe('planPushes', () => {
  it('longe da reunião: nada a disparar e acorda no aviso de 5 minutos', () => {
    const p = plan(START - 60 * MIN)
    expect(p.due).toEqual([])
    expect(p.nextWakeAt).toBe(START - 5 * MIN)
  })

  it('sem reunião à vista: acorda no ressincronismo', () => {
    const now = START - 10 * HOUR
    expect(plan(now).nextWakeAt).toBe(now + 3 * HOUR)
    expect(plan(now, { events: [] }).nextWakeAt).toBe(now + 3 * HOUR)
  })

  it('aos 5 minutos: dispara o aviso crítico e depois acorda no início', () => {
    const p = plan(START - 5 * MIN)
    expect(p.due).toHaveLength(1)
    expect(p.due[0]).toMatchObject({ eventId: 'ev1', kind: 'critical', title: '⚠️ Em 5 min: Daily', repeat: 1 })
    expect(p.nextWakeAt).toBe(START)
    expect(p.firedKeys).toEqual([`ev1|${START}|critical`])
  })

  it('acordou atrasado dentro da janela crítica: o título diz os minutos que restam', () => {
    const p = plan(START - 3 * MIN + 1000)
    expect(p.due[0].title).toBe('⚠️ Em 3 min: Daily')
  })

  it('no início: dispara o aviso máximo, repetido 3 vezes', () => {
    const p = plan(START, { fired: [`ev1|${START}|critical`] })
    expect(p.due).toHaveLength(1)
    expect(p.due[0]).toMatchObject({ kind: 'maximum', title: '🚨 REUNIÃO AGORA: Daily', repeat: 3 })
  })

  it('acordou depois do início sem ter avisado: manda só o máximo e marca os dois', () => {
    const p = plan(START + 2 * MIN)
    expect(p.due.map((d) => d.kind)).toEqual(['maximum'])
    expect(p.firedKeys.sort()).toEqual([`ev1|${START}|critical`, `ev1|${START}|maximum`])
  })

  it('nunca repete um aviso já disparado', () => {
    const fired = [`ev1|${START}|critical`, `ev1|${START}|maximum`]
    expect(plan(START + MIN, { fired }).due).toEqual([])
  })

  it('reunião começou há mais de 10 minutos: não dispara mais', () => {
    expect(plan(START + 10 * MIN).due).toEqual([])
    expect(plan(START + 10 * MIN - 1).due).toHaveLength(1)
  })

  it('reunião silenciada não dispara nem agenda', () => {
    const now = START - 5 * MIN
    const p = plan(now, { silencedIds: ['ev1'] })
    expect(p.due).toEqual([])
    expect(p.nextWakeAt).toBe(now + 3 * HOUR)
  })

  it('reunião remarcada dispara de novo no horário novo', () => {
    const novoInicio = START + HOUR
    const p = planPushes({
      events: [{ ...reuniao, start: new Date(novoInicio).toISOString() }],
      now: novoInicio - 5 * MIN,
      fired: [`ev1|${START}|critical`, `ev1|${START}|maximum`],
      silencedIds: [],
      criticalMinutes: 5,
      resyncMs: 3 * HOUR,
    })
    expect(p.due).toHaveLength(1)
    expect(p.due[0].kind).toBe('critical')
  })

  it('minutos de antecedência configuráveis', () => {
    const p = plan(START - 15 * MIN, { criticalMinutes: 15 })
    expect(p.due[0].title).toBe('⚠️ Em 15 min: Daily')
  })

  it('o corpo traz a hora de Brasília e o aviso de Meet; a url aponta para o Meet', () => {
    const comMeet = { ...reuniao, hangoutLink: 'https://meet.google.com/abc' }
    const p = plan(START, { events: [comMeet] })
    expect(p.due[0].body).toBe('15:00 — Google Meet disponível')
    expect(p.due[0].url).toBe('https://meet.google.com/abc')
    expect(plan(START).due[0]).toMatchObject({ body: '15:00', url: '/' })
  })

  it('várias reuniões: acorda na mais próxima', () => {
    const outra = { id: 'ev2', summary: 'Review', start: new Date(START - 30 * MIN).toISOString() }
    const p = plan(START - 50 * MIN, { events: [reuniao, outra] })
    expect(p.nextWakeAt).toBe(START - 35 * MIN)
  })

  it('descarta marcas de disparo com mais de 24 horas', () => {
    const now = START - HOUR
    const velho = `evX|${now - 24 * HOUR - 1}|maximum`
    const noLimite = `evY|${now - 24 * HOUR}|maximum`
    expect(plan(now, { fired: [velho, noLimite] }).firedKeys).toEqual([noLimite])
  })
})

const base: WatchState = {
  userKey: 'u1',
  encRefreshToken: 'enc-a',
  subs: [{ endpoint: 'https://push/a', keys: { p256dh: 'p', auth: 'a' } }],
  fired: [],
  silenced: [],
  criticalMinutes: 5,
  lastHello: 1000,
}

describe('applySignal', () => {
  it('hello acrescenta aparelho novo e atualiza credencial e data', () => {
    const sub = { endpoint: 'https://push/b', keys: { p256dh: 'p2', auth: 'a2' } }
    const s = applySignal(base, { type: 'hello', at: 5000, sub, encRefreshToken: 'enc-b', criticalMinutes: 10 })
    expect(s.subs.map((x) => x.endpoint)).toEqual(['https://push/a', 'https://push/b'])
    expect(s).toMatchObject({ encRefreshToken: 'enc-b', criticalMinutes: 10, lastHello: 5000 })
  })

  it('hello do mesmo aparelho substitui as chaves em vez de duplicar', () => {
    const sub = { endpoint: 'https://push/a', keys: { p256dh: 'novo', auth: 'novo' } }
    const s = applySignal(base, { type: 'hello', at: 5000, sub })
    expect(s.subs).toEqual([sub])
    expect(s.encRefreshToken).toBe('enc-a')
  })

  it('silence guarda a reunião com o dia; unsubscribe remove o aparelho', () => {
    const s = applySignal(base, { type: 'silence', eventId: 'ev1', day: '2026-11-12' })
    expect(s.silenced).toEqual([{ id: 'ev1', day: '2026-11-12' }])
    expect(applySignal(base, { type: 'unsubscribe', endpoint: 'https://push/a' }).subs).toEqual([])
  })

  it('changed não altera o estado', () => {
    expect(applySignal(base, { type: 'changed' })).toEqual(base)
  })

  it('merge une aparelhos e disparos de outro vigia sem duplicar', () => {
    const outro = { subs: [base.subs[0], { endpoint: 'https://push/c', keys: { p256dh: 'p', auth: 'a' } }], fired: ['k1'], silenced: [{ id: 'e', day: 'd' }] }
    const s = applySignal({ ...base, fired: ['k1', 'k2'] }, { type: 'merge', ...outro })
    expect(s.subs.map((x) => x.endpoint)).toEqual(['https://push/a', 'https://push/c'])
    expect(s.fired.sort()).toEqual(['k1', 'k2'])
    expect(s.silenced).toEqual([{ id: 'e', day: 'd' }])
  })
})

describe('shouldStop', () => {
  const DIA = 24 * HOUR
  it('para sem aparelhos ou após 30 dias sem o app abrir', () => {
    expect(shouldStop({ ...base, subs: [] }, 2000)).toBe(true)
    expect(shouldStop(base, 1000 + 30 * DIA + 1)).toBe(true)
    expect(shouldStop(base, 1000 + 30 * DIA)).toBe(false)
  })
})
