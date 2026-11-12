import { describe, expect, it } from 'vitest'
import type { PlanEvent, PushSub, WatchState } from './pushPlan'
import { InvalidGrantError, type WatchChannel } from './vigiaGoogle'
import { runTick, type TickDeps } from './vigiaTick'

const MIN = 60_000
const HOUR = 60 * MIN
// 12/11/2026 15:00 BRT
const START = Date.UTC(2026, 10, 12, 18, 0, 0)
const reuniao: PlanEvent = { id: 'ev1', summary: 'Daily', start: new Date(START).toISOString() }
const sub = (nome: string): PushSub => ({ endpoint: `https://push/${nome}`, keys: { p256dh: 'p', auth: 'a' } })

const estado = (extra: Partial<WatchState> = {}): WatchState => ({
  userKey: 'u1', encRefreshToken: 'enc', subs: [sub('a')], fired: [], silenced: [], criticalMinutes: 5, lastHello: START, ...extra,
})

function deps(extra: Partial<TickDeps> = {}) {
  const enviados: Array<{ endpoint: string; title: string }> = []
  const canalNovo: WatchChannel = { id: 'c2', resourceId: 'r2', expiration: START + 100 * HOUR }
  const d: TickDeps = {
    getAccessToken: async () => 'acesso',
    listEvents: async () => [reuniao],
    ensureChannel: async () => canalNovo,
    send: async (s, payload) => { enviados.push({ endpoint: s.endpoint, title: JSON.parse(payload).title }) },
    wait: async () => undefined,
    ...extra,
  }
  return { d, enviados, canalNovo }
}

describe('runTick', () => {
  it('na hora do aviso: envia, marca como disparado e agenda o próximo despertar', async () => {
    const { d, enviados, canalNovo } = deps()
    const r = await runTick({ state: estado(), channel: null, errors: 0, now: START - 5 * MIN }, d)
    expect(enviados).toEqual([{ endpoint: 'https://push/a', title: '⚠️ Em 5 min: Daily' }])
    expect(r).toMatchObject({ now: START - 5 * MIN, nextWakeAt: START, errors: 0, channel: canalNovo })
    expect(r.fired).toEqual([`ev1|${START}|critical`])
    expect(r.stop).toBeUndefined()
  })

  it('fora de hora: não envia nada e dorme até o aviso', async () => {
    const { d, enviados } = deps()
    const r = await runTick({ state: estado(), channel: null, errors: 0, now: START - HOUR }, d)
    expect(enviados).toEqual([])
    expect(r.nextWakeAt).toBe(START - 5 * MIN)
  })

  it('silêncio vale só no dia em que foi pedido (horário de Brasília)', async () => {
    const hoje = deps()
    await runTick({ state: estado({ silenced: [{ id: 'ev1', day: '2026-11-12' }] }), channel: null, errors: 0, now: START }, hoje.d)
    expect(hoje.enviados).toEqual([])

    const ontem = deps()
    await runTick({ state: estado({ silenced: [{ id: 'ev1', day: '2026-11-11' }] }), channel: null, errors: 0, now: START }, ontem.d)
    expect(ontem.enviados).toHaveLength(3)
  })

  it('aparelho extinto sai do estado', async () => {
    const { d } = deps({ send: async (s) => { if (s.endpoint.endsWith('/morto')) throw Object.assign(new Error('gone'), { statusCode: 410 }) } })
    const r = await runTick({ state: estado({ subs: [sub('morto'), sub('a')] }), channel: null, errors: 0, now: START - 5 * MIN }, d)
    expect(r.subs.map((s) => s.endpoint)).toEqual(['https://push/a'])
  })

  it('credencial recusada pelo Google: avisa os aparelhos e manda parar', async () => {
    const { d, enviados } = deps({ getAccessToken: async () => { throw new InvalidGrantError() } })
    const canal: WatchChannel = { id: 'c1', resourceId: 'r1', expiration: START + HOUR }
    const r = await runTick({ state: estado(), channel: canal, errors: 0, now: START - 5 * MIN }, d)
    expect(r.stop).toBe('credencial-recusada')
    expect(enviados).toEqual([{ endpoint: 'https://push/a', title: '⚠️ Avisos de reunião pausados' }])
    expect(r.channel).toBe(canal)
  })

  it('falha passageira: mantém o estado e tenta de novo com espera crescente até 30 min', async () => {
    const { d, enviados } = deps({ listEvents: async () => { throw new Error('calendar 503') } })
    const now = START - 5 * MIN
    const state = estado({ fired: ['x|1|critical'] })
    const esperaMin = async (errors: number) => ((await runTick({ state, channel: null, errors, now }, d)).nextWakeAt - now) / MIN

    const r = await runTick({ state, channel: null, errors: 0, now }, d)
    expect(r).toMatchObject({ errors: 1, fired: ['x|1|critical'], subs: state.subs, channel: null })
    expect(r.stop).toBeUndefined()
    expect(enviados).toEqual([])
    expect(await esperaMin(0)).toBe(1)
    expect(await esperaMin(1)).toBe(2)
    expect(await esperaMin(3)).toBe(8)
    expect(await esperaMin(5)).toBe(30)
    expect(await esperaMin(9)).toBe(30)
  })

  it('falha ao renovar o canal não impede o aviso', async () => {
    const { d, enviados } = deps({ ensureChannel: async () => { throw new Error('watch 500') } })
    const r = await runTick({ state: estado(), channel: null, errors: 0, now: START - 5 * MIN }, d)
    expect(enviados).toHaveLength(1)
    expect(r).toMatchObject({ errors: 0, channel: null, nextWakeAt: START })
  })

  it('depois de uma falha, um tique bom zera o contador', async () => {
    const { d } = deps()
    expect((await runTick({ state: estado(), channel: null, errors: 4, now: START - HOUR }, d)).errors).toBe(0)
  })
})
