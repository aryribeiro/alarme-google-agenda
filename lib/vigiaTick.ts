// Um "tique" do vigia: lê a agenda, decide (pushPlan), envia e renova o canal.
// Toda a rede entra por TickDeps; o step do workflow só monta as dependências reais.
import { getBrtDateString } from './brtDate'
import { planPushes, type DuePush, type PlanEvent, type PushSub, type WatchState } from './pushPlan'
import { InvalidGrantError, type WatchChannel } from './vigiaGoogle'
import { sendDuePushes, type SendFn } from './vigiaPush'

const MIN = 60_000
// Rede de segurança: o aviso de mudança do Google "não é 100% confiável" (doc oficial)
const RESYNC_MS = 3 * 60 * MIN
const MAX_BACKOFF_MIN = 30

export interface TickDeps {
  getAccessToken: (encRefreshToken: string) => Promise<string>
  listEvents: (accessToken: string, now: number) => Promise<PlanEvent[]>
  ensureChannel: (accessToken: string, channel: WatchChannel | null, now: number) => Promise<WatchChannel | null>
  send: SendFn
  wait?: (ms: number) => Promise<void>
}

export interface TickInput {
  state: WatchState
  channel: WatchChannel | null
  errors: number
  now: number
}

export interface TickResult {
  now: number
  fired: string[]
  subs: PushSub[]
  channel: WatchChannel | null
  nextWakeAt: number
  errors: number
  stop?: 'credencial-recusada'
}

const PAUSED_NOTICE: DuePush = {
  key: 'pausado',
  eventId: 'vigia-pausado',
  kind: 'critical',
  title: '⚠️ Avisos de reunião pausados',
  body: 'Abra o Alarme Google Agenda e entre de novo com o Google para reativar.',
  url: '/',
  repeat: 1,
}

function unchanged(input: TickInput): Pick<TickResult, 'now' | 'fired' | 'subs' | 'channel'> {
  return { now: input.now, fired: input.state.fired, subs: input.state.subs, channel: input.channel }
}

async function stopForInvalidGrant(input: TickInput, deps: TickDeps): Promise<TickResult> {
  // Parar calado seria o pior defeito: o dono acharia que está protegido
  const subs = await sendDuePushes(input.state.subs, [PAUSED_NOTICE], deps.send, deps.wait)
  return { ...unchanged(input), subs, nextWakeAt: input.now, errors: 0, stop: 'credencial-recusada' }
}

function retryLater(input: TickInput): TickResult {
  const backoffMin = Math.min(2 ** input.errors, MAX_BACKOFF_MIN)
  return { ...unchanged(input), nextWakeAt: input.now + backoffMin * MIN, errors: input.errors + 1 }
}

async function alarmRound(input: TickInput, deps: TickDeps): Promise<TickResult> {
  const { state, now } = input
  const accessToken = await deps.getAccessToken(state.encRefreshToken)
  const events = await deps.listEvents(accessToken, now)

  const today = getBrtDateString(now)
  const plan = planPushes({
    events,
    now,
    fired: state.fired,
    silencedIds: state.silenced.filter((s) => s.day === today).map((s) => s.id),
    criticalMinutes: state.criticalMinutes,
    resyncMs: RESYNC_MS,
  })

  const subs = await sendDuePushes(state.subs, plan.due, deps.send, deps.wait)
  // O canal é conforto (acordar na mudança); sem ele o ressincronismo cobre
  const channel = await deps.ensureChannel(accessToken, input.channel, now).catch(() => input.channel)
  return { now, fired: plan.firedKeys, subs, channel, nextWakeAt: plan.nextWakeAt, errors: 0 }
}

export async function runTick(input: TickInput, deps: TickDeps): Promise<TickResult> {
  try {
    return await alarmRound(input, deps)
  } catch (error) {
    if (error instanceof InvalidGrantError) return stopForInvalidGrant(input, deps)
    console.error('[vigia] tique falhou:', error instanceof Error ? error.message : 'erro desconhecido')
    return retryLater(input)
  }
}
