/** Supabase·Node fetch 일시 오류 — 짧게 재시도할 때 씁니다 */
export function isTransientFetchErrorMessage(message: string): boolean {
  return /fetch failed|failed to fetch|load failed|network|timed out|econnrefused|enotfound|etimedout|abort/i.test(
    message,
  )
}

export function isTransientFetchError(error: unknown): boolean {
  if (error instanceof Error) return isTransientFetchErrorMessage(error.message)
  if (error && typeof error === 'object' && 'message' in error) {
    return isTransientFetchErrorMessage(String((error as { message: unknown }).message))
  }
  return false
}

export const SUPABASE_FETCH_RETRY_DELAYS_MS = [0, 300, 800] as const

export async function delayMs(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((r) => setTimeout(r, ms))
}
