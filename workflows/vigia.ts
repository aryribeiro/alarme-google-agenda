// Vigia de push: um por usuário, vive no servidor e avisa o celular mesmo com a tela apagada.
// Ciclo: tique (lê agenda, envia o que venceu) -> dorme até o próximo aviso OU até chegar um sinal
// (app aberto, agenda mudou no Google, reunião silenciada). Dormir não consome nada.
import { createHook, sleep } from 'workflow'
import { start } from 'workflow/api'
import { HookForceClaimedError } from 'workflow/errors'
import { applySignal, shouldStop, type Signal, type WatchState } from '../lib/pushPlan'
import type { WatchChannel } from '../lib/vigiaGoogle'
import { forwardSignal, tick } from './vigiaSteps'

export interface VigiaInput {
  state: WatchState
  channel: WatchChannel | null
}

// Cada execução fica presa ao deploy em que nasceu; a troca diária põe o vigia no deploy mais novo
const HANDOFF_AFTER_MS = 24 * 60 * 60 * 1000
const RETIRE_TIMEOUT = '10m'

type Outcome = { kind: 'signal'; signal: Signal } | { kind: 'timer' }

export async function vigiaAgenda(input: VigiaInput) {
  'use workflow'

  const token = `vigia:${input.state.userKey}`
  // O vigia mais novo sempre fica com o token; o anterior recebe HookForceClaimedError e se retira
  const hook = createHook<Signal>({ token, experimental_force: true })
  const signals = hook[Symbol.asyncIterator]()

  let state = input.state
  let channel = input.channel
  let errors = 0
  let startedAt: number | null = null
  let retiring = false

  const waitSignal = () => {
    const next = signals.next().then((r): Outcome => ({ kind: 'signal', signal: r.value as Signal }))
    // A rejeição é tratada no race; isto só evita "unhandled rejection" enquanto um step roda
    next.catch(() => undefined)
    return next
  }
  let nextSignal = waitSignal()

  try {
    while (true) {
      let wake: Promise<Outcome>

      if (retiring) {
        wake = sleep(RETIRE_TIMEOUT).then((): Outcome => ({ kind: 'timer' }))
      } else {
        const r = await tick(state, channel, errors)
        state = { ...state, fired: r.fired, subs: r.subs }
        channel = r.channel
        errors = r.errors
        if (r.stop) return { ended: r.stop }
        if (shouldStop(state, r.now)) return { ended: 'sem-aparelhos-ou-ocioso' }

        startedAt ??= r.now
        if (r.now - startedAt >= HANDOFF_AFTER_MS) {
          await start(vigiaAgenda, [{ state, channel }], { deploymentId: 'latest' })
          retiring = true
          continue
        }
        wake = sleep(new Date(r.nextWakeAt)).then((): Outcome => ({ kind: 'timer' }))
      }

      const outcome = await Promise.race([nextSignal, wake])
      if (outcome.kind === 'signal') {
        state = applySignal(state, outcome.signal)
        nextSignal = waitSignal()
      } else if (retiring) {
        return { ended: 'troca-sem-sucessor' }
      }
    }
  } catch (error) {
    if (!HookForceClaimedError.is(error)) throw error
    // Fui substituído: entrego ao sucessor o que só eu sabia (aparelhos, disparos, silêncios)
    await forwardSignal(token, { type: 'merge', subs: state.subs, fired: state.fired, silenced: state.silenced })
    return { ended: 'substituido' }
  }
}
