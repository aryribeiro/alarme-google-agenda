export type GoogleErrorCode =
  | 'TOKEN_EXPIRED'
  | 'SYNC_TOKEN_EXPIRED'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN'

export interface GoogleCalendarError {
  code: GoogleErrorCode
  message: string
  status: number
  retryable: boolean
  retryAfterMs?: number
}

export function parseGoogleError(error: unknown): GoogleCalendarError {
  if (error && typeof error === 'object' && 'response' in error) {
    const err = error as {
      response?: {
        status?: number
        data?: { error?: { errors?: Array<{ reason?: string }>; message?: string } }
        headers?: Record<string, string>
      }
      message?: string
    }
    const status = err.response?.status || 0
    const apiError = err.response?.data?.error
    const reason = apiError?.errors?.[0]?.reason

    switch (status) {
      case 401:
        return {
          code: 'TOKEN_EXPIRED',
          message: 'Token de acesso expirado. Faça login novamente.',
          status: 401,
          retryable: false,
        }

      case 403: {
        if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
          return {
            code: 'RATE_LIMITED',
            message: 'Limite de requisições atingido. Aguardando...',
            status: 403,
            retryable: true,
            retryAfterMs: 1000 + Math.random() * 1000,
          }
        }
        if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
          return {
            code: 'QUOTA_EXCEEDED',
            message: 'Cota diária da API excedida.',
            status: 403,
            retryable: false,
          }
        }
        return {
          code: 'FORBIDDEN',
          message: apiError?.message || 'Acesso negado ao calendário.',
          status: 403,
          retryable: false,
        }
      }

      case 404:
        return {
          code: 'NOT_FOUND',
          message: 'Calendário não encontrado.',
          status: 404,
          retryable: false,
        }

      case 410:
        return {
          code: 'SYNC_TOKEN_EXPIRED',
          message: 'Token de sincronização expirado.',
          status: 410,
          retryable: false,
        }

      case 429: {
        const retryAfter = err.response?.headers?.['retry-after']
        return {
          code: 'RATE_LIMITED',
          message: 'Muitas requisições. Aguardando...',
          status: 429,
          retryable: true,
          retryAfterMs: retryAfter ? parseInt(retryAfter) * 1000 : 5000,
        }
      }

      case 500:
      case 502:
      case 503:
        return {
          code: 'SERVER_ERROR',
          message: 'Erro temporário do Google. Tentando novamente...',
          status,
          retryable: true,
          retryAfterMs: 2000 + Math.random() * 1000,
        }

      default:
        return {
          code: 'UNKNOWN',
          message: apiError?.message || err.message || 'Erro desconhecido na API.',
          status,
          retryable: status >= 500,
        }
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('enotfound') || msg.includes('fetch failed')) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Erro de conexão com o Google.',
        status: 0,
        retryable: true,
        retryAfterMs: 3000,
      }
    }
  }

  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : 'Erro desconhecido.',
    status: 0,
    retryable: false,
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const parsed = parseGoogleError(error)
      if (!parsed.retryable || attempt === maxRetries) throw error
      await new Promise((r) => setTimeout(r, parsed.retryAfterMs || 1000))
    }
  }
  throw lastError
}
