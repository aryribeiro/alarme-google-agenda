// Gerador de áudio silencioso e gerenciamento de MediaSession para manter
// o ciclo de vida do áudio ativo no iOS Safari e Android Chrome com a tela desligada.

// WAV mínimo de 1 segundo de silêncio (PCM 8kHz 8-bit mono) codificado em base64
const SILENT_WAV_BASE64 =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

class SilentAudioController {
  private audio: HTMLAudioElement | null = null
  private isRunning: boolean = false

  public init() {
    if (typeof window === 'undefined' || this.audio) return
    try {
      const audio = new Audio(SILENT_WAV_BASE64)
      audio.loop = true
      audio.volume = 0.001 // Inaudível, mantendo hardware e thread de áudio ativos
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
