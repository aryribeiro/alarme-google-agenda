// Gerador de áudio silencioso e gerenciamento de MediaSession para manter
// o ciclo de vida do áudio ativo no iOS Safari e Android Chrome com a tela desligada.

// MP3 de 10 s com ruído a −80 dB: inaudível, mas não é silêncio digital.
// O Chrome Android só mantém em 2º plano mídia com 5 s ou mais, e silêncio
// absoluto não conta como áudio tocando (a aba volta a ser estrangulada).
const SILENT_AUDIO_SRC = '/som/silencio.mp3'

class SilentAudioController {
  private audio: HTMLAudioElement | null = null
  private isRunning: boolean = false

  public init() {
    if (typeof window === 'undefined' || this.audio) return
    try {
      const audio = new Audio(SILENT_AUDIO_SRC)
      audio.loop = true
      // Volume cheio: o próprio arquivo já é inaudível; volume quase zero vira silêncio para o navegador
      audio.preload = 'auto'
      this.audio = audio
    } catch (err) {
      console.warn('Erro ao inicializar áudio de keep-alive:', err)
    }
  }

  public async start(): Promise<boolean> {
    if (typeof window === 'undefined') return false
    if (!this.audio) this.init()
    if (!this.audio) return false

    try {
      await this.audio.play()
      this.isRunning = true
      this.updateMediaSession(false)
      return true
    } catch {
      return false
    }
  }

  public pause() {
    if (this.audio && this.isRunning) {
      this.audio.pause()
      this.isRunning = false
    }
  }

  public resume() {
    if (this.audio && !this.isRunning) {
      this.audio.play().then(() => {
        this.isRunning = true
        this.updateMediaSession(false)
      }).catch(() => {})
    }
  }

  public updateMediaSession(isAlarming: boolean, titleText?: string) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return

    try {
      if (isAlarming) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: titleText || '🚨 REUNIÃO AGORA!',
          artist: 'Alarme Google Agenda',
          album: 'Alerta Ativo',
          artwork: [
            { src: '/som/logo.png', sizes: '192x192', type: 'image/png' },
            { src: '/som/logo.png', sizes: '512x512', type: 'image/png' },
          ],
        })
        navigator.mediaSession.playbackState = 'playing'
      } else {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Monitorando Agenda',
          artist: 'Alarme Google Agenda 2026',
          album: 'Segundo Plano Ativo (Tela Desligada)',
          artwork: [
            { src: '/som/logo.png', sizes: '192x192', type: 'image/png' },
            { src: '/som/logo.png', sizes: '512x512', type: 'image/png' },
          ],
        })
        navigator.mediaSession.playbackState = 'playing'
      }

      navigator.mediaSession.setActionHandler('play', () => {
        this.resume()
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        this.pause()
      })
      navigator.mediaSession.setActionHandler('stop', () => {
        this.pause()
      })
    } catch {
      // Browsers sem suporte a MediaMetadata
    }
  }
}

export const silentAudio = new SilentAudioController()
