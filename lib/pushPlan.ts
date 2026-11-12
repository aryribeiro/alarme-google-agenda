// Regra pura do vigia de push: o que disparar agora e quando acordar de novo.
// Sem rede e sem relógio próprio: o "agora" vem de fora.

export type PushKind = 'critical' | 'maximum'

export interface PushSub {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface PlanEvent {
  id: string
  summary: string
  start: string
  hangoutLink?: string
}

export interface DuePush {
  key: string
  eventId: string
  kind: PushKind
  title: string
  body: string
  url: string
  repeat: number
}

export interface Plan {
  due: DuePush[]
  nextWakeAt: number
  firedKeys: string[]
}

export interface WatchState {
  userKey: string
  encRefreshToken: string
  subs: PushSub[]
  fired: string[]
  silenced: Array<{ id: string; day: string }>
  criticalMinutes: number
  lastHello: number
}

export type Signal =
  | { type: 'hello'; at: number; sub?: PushSub; encRefreshToken?: string; criticalMinutes?: number }
  | { type: 'changed' }
  | { type: 'silence'; eventId: string; day: string }
  | { type: 'unsubscribe'; endpoint: string }
  | { type: 'merge'; subs: PushSub[]; fired: string[]; silenced: Array<{ id: string; day: string }> }

const MIN = 60_000
const HOUR = 60 * MIN
// Depois disso a reunião já vai longe: avisar seria ruído
const LATE_MS = 10 * MIN
const FIRED_TTL_MS = 24 * HOUR
const IDLE_LIMIT_MS = 30 * 24 * HOUR
const MAXIMUM_REPEAT = 3

interface PlanInput {
  events: PlanEvent[]
  now: number
  fired: string[]
  silencedIds: string[]
  criticalMinutes: number
  resyncMs: number
}

// O início entra na chave: reunião remarcada volta a avisar no horário novo
function pushKey(eventId: string, startMs: number, kind: PushKind): string {
  return `${eventId}|${startMs}|${kind}`
}

function brtHourMinute(ms: number): string {
  return new Date(ms - 3 * HOUR).toISOString().slice(11, 16)
}

function buildPush(event: PlanEvent, startMs: number, kind: PushKind, now: number): DuePush {
  const minutesLeft = Math.ceil((startMs - now) / MIN)
  const title = kind === 'maximum'
    ? `🚨 REUNIÃO AGORA: ${event.summary}`
    : `⚠️ Em ${minutesLeft} min: ${event.summary}`

  return {
    key: pushKey(event.id, startMs, kind),
    eventId: event.id,
    kind,
    title,
    body: `${brtHourMinute(startMs)}${event.hangoutLink ? ' — Google Meet disponível' : ''}`,
    url: event.hangoutLink || '/',
    repeat: kind === 'maximum' ? MAXIMUM_REPEAT : 1,
  }
}

/** Avisos de uma reunião: o que vence agora (só o mais recente) e o próximo horário de acordar. */
function planEvent(event: PlanEvent, input: PlanInput): { due?: DuePush; passedKeys: string[]; nextAt?: number } {
  const startMs = new Date(event.start).getTime()
  const points: Array<{ kind: PushKind; at: number }> = [
    { kind: 'critical', at: startMs - input.criticalMinutes * MIN },
    { kind: 'maximum', at: startMs },
  ]

  const nextAt = points.find((p) => p.at > input.now)?.at
  const passed = points.filter((p) => p.at <= input.now)
  const passedKeys = passed.map((p) => pushKey(event.id, startMs, p.kind))

  const latest = passed[passed.length - 1]
  const stillRelevant = input.now < startMs + LATE_MS
  const alreadyFired = latest ? input.fired.includes(pushKey(event.id, startMs, latest.kind)) : true
  const due = latest && stillRelevant && !alreadyFired ? buildPush(event, startMs, latest.kind, input.now) : undefined

  return { due, passedKeys: due ? passedKeys : [], nextAt }
}

function keyStartMs(key: string): number {
  return Number(key.split('|')[1])
}

export function planPushes(input: PlanInput): Plan {
  const due: DuePush[] = []
  const fired = new Set(input.fired)
  let nextWakeAt = input.now + input.resyncMs

  for (const event of input.events) {
    if (input.silencedIds.includes(event.id)) continue
    const result = planEvent(event, input)
    if (result.due) due.push(result.due)
    result.passedKeys.forEach((key) => fired.add(key))
    if (result.nextAt !== undefined && result.nextAt < nextWakeAt) nextWakeAt = result.nextAt
  }

  const firedKeys = Array.from(fired).filter((key) => keyStartMs(key) >= input.now - FIRED_TTL_MS)
  return { due, nextWakeAt, firedKeys }
}

function upsertSub(subs: PushSub[], sub: PushSub): PushSub[] {
  return [...subs.filter((s) => s.endpoint !== sub.endpoint), sub]
}

export function applySignal(state: WatchState, signal: Signal): WatchState {
  switch (signal.type) {
    case 'hello':
      return {
        ...state,
        subs: signal.sub ? upsertSub(state.subs, signal.sub) : state.subs,
        encRefreshToken: signal.encRefreshToken ?? state.encRefreshToken,
        criticalMinutes: signal.criticalMinutes ?? state.criticalMinutes,
        lastHello: signal.at,
      }
    case 'silence':
      return { ...state, silenced: [...state.silenced, { id: signal.eventId, day: signal.day }] }
    case 'unsubscribe':
      return { ...state, subs: state.subs.filter((s) => s.endpoint !== signal.endpoint) }
    case 'merge':
      return {
        ...state,
        subs: signal.subs.reduce(upsertSub, state.subs),
        fired: Array.from(new Set([...state.fired, ...signal.fired])),
        silenced: [...state.silenced, ...signal.silenced],
      }
    case 'changed':
      return state
  }
}

export function shouldStop(state: WatchState, now: number): boolean {
  return state.subs.length === 0 || now - state.lastHello > IDLE_LIMIT_MS
}
