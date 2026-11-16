import { describe, expect, it } from 'vitest'
import { ensureWatchChannel, InvalidGrantError, listAppEvents, listUpcomingEvents, refreshAccessToken } from './vigiaGoogle'

const HOUR = 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 12, 18, 0, 0)

interface Call { url: string; init?: RequestInit }

function fakeFetch(responder: (url: string, init?: RequestInit) => { status?: number; body: unknown }) {
  const calls: Call[] = []
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const { status = 200, body } = responder(url, init)
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return { fn, calls }
}

const env = { clientId: 'cid', clientSecret: 'csec' }

describe('refreshAccessToken', () => {
  it('troca o refresh token por um access token', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { access_token: 'acesso-1' } }))
    expect(await refreshAccessToken('rt', env, fn)).toBe('acesso-1')
    expect(String(calls[0].init?.body)).toContain('refresh_token=rt')
  })

  it('invalid_grant vira erro próprio (só novo login resolve)', async () => {
    const { fn } = fakeFetch(() => ({ status: 400, body: { error: 'invalid_grant' } }))
    await expect(refreshAccessToken('rt', env, fn)).rejects.toBeInstanceOf(InvalidGrantError)
  })

  it('falha passageira não é confundida com credencial revogada', async () => {
    const { fn } = fakeFetch(() => ({ status: 503, body: { error: 'backend_error' } }))
    const erro = await refreshAccessToken('rt', env, fn).catch((e) => e)
    expect(erro).toBeInstanceOf(Error)
    expect(erro).not.toBeInstanceOf(InvalidGrantError)
  })
})

describe('listUpcomingEvents', () => {
  const item = (id: string, extra: object = {}) => ({ id, summary: `Reunião ${id}`, start: { dateTime: '2026-11-12T15:00:00-03:00' }, ...extra })

  it('devolve só o que merece alarme, já no formato do plano', async () => {
    const { fn, calls } = fakeFetch(() => ({
      body: {
        items: [
          item('a', { hangoutLink: 'https://meet.google.com/x' }),
          item('b', { status: 'cancelled' }),
          item('c', { attendees: [{ self: true, responseStatus: 'declined' }] }),
          { id: 'd', start: { date: '2026-11-12' } },
          item('e', { summary: null }),
        ],
      },
    }))

    const events = await listUpcomingEvents('acesso', NOW, fn)
    expect(events).toEqual([
      { id: 'a', summary: 'Reunião a', start: '2026-11-12T15:00:00-03:00', hangoutLink: 'https://meet.google.com/x' },
      { id: 'e', summary: '(Sem título)', start: '2026-11-12T15:00:00-03:00', hangoutLink: undefined },
    ])
    expect(calls[0].url).toContain('singleEvents=true')
    expect(calls[0].url).toContain(encodeURIComponent(new Date(NOW + 24 * HOUR).toISOString()))
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer acesso')
  })

  it('erro da API sobe como erro (o vigia tenta de novo depois)', async () => {
    const { fn } = fakeFetch(() => ({ status: 500, body: {} }))
    await expect(listUpcomingEvents('acesso', NOW, fn)).rejects.toThrow('calendar 500')
  })
})

describe('ensureWatchChannel', () => {
  const base = { accessToken: 'acesso', address: 'https://app.exemplo/api/calendar/webhook', token: 'vigia:abc', now: NOW, channelId: 'novo-id' }
  const criado = { body: { id: 'novo-id', resourceId: 'res-2', expiration: String(NOW + 7 * 24 * HOUR) } }

  it('canal com mais de 12 h de validade é mantido sem chamar a API', async () => {
    const { fn, calls } = fakeFetch(() => criado)
    const channel = { id: 'c1', resourceId: 'r1', expiration: NOW + 13 * HOUR }
    expect(await ensureWatchChannel({ ...base, channel }, fn)).toBe(channel)
    expect(calls).toHaveLength(0)
  })

  it('sem canal: cria um apontando para o webhook com o token do vigia', async () => {
    const { fn, calls } = fakeFetch(() => criado)
    const channel = await ensureWatchChannel({ ...base, channel: null }, fn)
    expect(channel).toEqual({ id: 'novo-id', resourceId: 'res-2', expiration: NOW + 7 * 24 * HOUR })
    const body = JSON.parse(String(calls[0].init?.body))
    expect(body).toMatchObject({ id: 'novo-id', type: 'web_hook', address: base.address, token: 'vigia:abc' })
    expect(calls).toHaveLength(1)
  })

  it('canal perto de vencer: cria o novo e encerra o velho', async () => {
    const { fn, calls } = fakeFetch((url) => (url.endsWith('/channels/stop') ? { body: {} } : criado))
    const velho = { id: 'c1', resourceId: 'r1', expiration: NOW + 11 * HOUR }
    const channel = await ensureWatchChannel({ ...base, channel: velho }, fn)
    expect(channel?.id).toBe('novo-id')
    expect(calls.map((c) => c.url.split('/v3')[1])).toEqual(['/calendars/primary/events/watch', '/channels/stop'])
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ id: 'c1', resourceId: 'r1' })
  })

  it('a API recusou criar: fica com o canal que tinha', async () => {
    const { fn } = fakeFetch(() => ({ status: 403, body: {} }))
    const velho = { id: 'c1', resourceId: 'r1', expiration: NOW + HOUR }
    expect(await ensureWatchChannel({ ...base, channel: velho }, fn)).toBe(velho)
  })

  it('endereço sem HTTPS (desenvolvimento local): não cria canal', async () => {
    const { fn, calls } = fakeFetch(() => criado)
    expect(await ensureWatchChannel({ ...base, address: 'http://localhost:3000/api/calendar/webhook', channel: null }, fn)).toBeNull()
    expect(calls).toHaveLength(0)
  })
})

describe('listAppEvents', () => {
  it('entrega ao app só o que merece alarme, com início, fim e o link da reunião', async () => {
    const { fn, calls } = fakeFetch(() => ({
      body: {
        items: [
          { id: 'meet', summary: 'Daily', start: { dateTime: '2026-11-12T15:00:00-03:00' }, end: { dateTime: '2026-11-12T15:30:00-03:00' }, hangoutLink: 'https://meet.google.com/abc' },
          { id: 'zoom', summary: null, start: { dateTime: '2026-11-12T16:00:00-03:00' }, end: { dateTime: '2026-11-12T17:00:00-03:00' }, description: 'Pauta em https://docs.exemplo.com e sala https://us02web.zoom.us/j/123' },
          { id: 'sem-fim', summary: 'Rápida', start: { dateTime: '2026-11-12T18:00:00-03:00' }, location: 'Sala 3' },
          { id: 'cancelada', summary: 'X', status: 'cancelled', start: { dateTime: '2026-11-12T15:00:00-03:00' } },
          { id: 'dia', summary: 'Feriado', start: { date: '2026-11-12' } },
        ],
      },
    }))

    const eventos = await listAppEvents('acesso', NOW, fn)

    expect(eventos).toEqual([
      { id: 'meet', titulo: 'Daily', inicio: Date.parse('2026-11-12T18:00:00Z'), fim: Date.parse('2026-11-12T18:30:00Z'), link: 'https://meet.google.com/abc' },
      { id: 'zoom', titulo: '(Sem título)', inicio: Date.parse('2026-11-12T19:00:00Z'), fim: Date.parse('2026-11-12T20:00:00Z'), link: 'https://us02web.zoom.us/j/123' },
      { id: 'sem-fim', titulo: 'Rápida', inicio: Date.parse('2026-11-12T21:00:00Z'), fim: Date.parse('2026-11-12T21:00:00Z'), link: null },
    ])
    expect(decodeURIComponent(calls[0].url)).toContain('end,')
    expect(decodeURIComponent(calls[0].url)).toContain('description')
  })

  it('o vigia de push continua recebendo o mesmo formato de antes', async () => {
    const { fn } = fakeFetch(() => ({
      body: { items: [{ id: 'a', summary: 'A', start: { dateTime: '2026-11-12T15:00:00-03:00' }, end: { dateTime: '2026-11-12T16:00:00-03:00' }, description: 'https://zoom.us/j/1' }] },
    }))
    expect(await listUpcomingEvents('acesso', NOW, fn)).toEqual([
      { id: 'a', summary: 'A', start: '2026-11-12T15:00:00-03:00', hangoutLink: undefined },
    ])
  })
})
