/**
 * Data (YYYY-MM-DD) no horário de Brasília (UTC-3, sem horário de verão).
 * toISOString() puro vira o dia às 21h BRT.
 */
export function getBrtDateString(now: number = Date.now()): string {
  return new Date(now - 3 * 60 * 60 * 1000).toISOString().split('T')[0]
}
