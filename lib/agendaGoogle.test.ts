import { describe, expect, it } from 'vitest'
import { InvalidGrantError, listAppEvents, refreshAccessToken } from './agendaGoogle'

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
})
