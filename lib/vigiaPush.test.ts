import { describe, expect, it } from 'vitest'
import type { DuePush, PushSub } from './pushPlan'
import { sendDuePushes } from './vigiaPush'

const sub = (nome: string): PushSub => ({ endpoint: `https://push/${nome}`, keys: { p256dh: 'p', auth: 'a' } })
const aviso = (extra: Partial<DuePush> = {}): DuePush => ({
  key: 'k', eventId: 'ev1', kind: 'critical', title: 'T', body: 'B', url: '/', repeat: 1, ...extra,
})

function gravador(falhas: Record<string, number> = {}) {
  const envios: Array<{ endpoint: string; payload: Record<string, string> }> = []
  const esperas: number[] = []
  const send = async (s: PushSub, payload: string) => {
    envios.push({ endpoint: s.endpoint, payload: JSON.parse(payload) })
    const status = falhas[s.endpoint]
    if (status) throw Object.assign(new Error('falha'), { statusCode: status })
  }
  const wait = async (ms: number) => { esperas.push(ms) }
  return { envios, esperas, send, wait }
}

describe('sendDuePushes', () => {
  it('manda cada aviso a todos os aparelhos, com a reunião como etiqueta', async () => {
    const g = gravador()
    const vivos = await sendDuePushes([sub('a'), sub('b')], [aviso()], g.send, g.wait)
    expect(g.envios.map((e) => e.endpoint)).toEqual(['https://push/a', 'https://push/b'])
    expect(g.envios[0].payload).toEqual({ title: 'T', body: 'B', tag: 'ev1', url: '/', level: 'critical' })
    expect(vivos).toHaveLength(2)
    expect(g.esperas).toEqual([])
  })

  it('"reunião agora" é reemitida 3 vezes com pausa; o aviso simples vai uma vez só', async () => {
    const g = gravador()
    await sendDuePushes([sub('a')], [aviso({ kind: 'maximum', repeat: 3, title: 'AGORA' }), aviso({ eventId: 'ev2', title: 'SIMPLES' })], g.send, g.wait)
    expect(g.envios.map((e) => e.payload.title)).toEqual(['AGORA', 'SIMPLES', 'AGORA', 'AGORA'])
    expect(g.esperas).toEqual([5000, 5000])
  })

  it('aparelho extinto (404/410) sai da lista e não recebe as repetições', async () => {
    const g = gravador({ 'https://push/morto': 410, 'https://push/sumiu': 404 })
    const vivos = await sendDuePushes([sub('morto'), sub('a'), sub('sumiu')], [aviso({ repeat: 2 })], g.send, g.wait)
    expect(vivos.map((s) => s.endpoint)).toEqual(['https://push/a'])
    expect(g.envios.map((e) => e.endpoint)).toEqual(['https://push/morto', 'https://push/a', 'https://push/sumiu', 'https://push/a'])
  })

  it('falha passageira (500) não remove o aparelho', async () => {
    const g = gravador({ 'https://push/a': 500 })
    expect(await sendDuePushes([sub('a')], [aviso()], g.send, g.wait)).toHaveLength(1)
  })

  it('sem avisos ou sem aparelhos não envia nada', async () => {
    const g = gravador()
    expect(await sendDuePushes([sub('a')], [], g.send, g.wait)).toHaveLength(1)
    expect(await sendDuePushes([], [aviso({ repeat: 3 })], g.send, g.wait)).toEqual([])
    expect(g.envios).toEqual([])
    expect(g.esperas).toEqual([])
  })
})
