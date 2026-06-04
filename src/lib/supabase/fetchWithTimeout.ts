import {
  SUPABASE_FETCH_RETRY_DELAYS_MS,
  delayMs,
  isTransientFetchError,
} from '@/lib/supabase/transientFetchError'

/**
 * Supabase HTTP 요청에 상한 시간을 둡니다.
 * 비개발자: Supabase 가 느리거나 멈춰 있을 때 앱이 오래 빈 화면만 보이지 않게,
 * 일정 시간(기본 12초) 지나면 포기합니다. `fetch failed` 는 잠깐 기다렸다 다시 시도합니다.
 */
export function wrapFetchWithTimeout(baseFetch: typeof fetch, timeoutMs = 12000): typeof fetch {
  return async (input, init) => {
    let lastErr: unknown

    for (let attempt = 0; attempt < SUPABASE_FETCH_RETRY_DELAYS_MS.length; attempt++) {
      await delayMs(SUPABASE_FETCH_RETRY_DELAYS_MS[attempt] ?? 0)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      const outerSignal = init?.signal
      if (outerSignal) {
        if (outerSignal.aborted) {
          clearTimeout(timer)
          throw outerSignal.reason ?? new DOMException('Aborted', 'AbortError')
        }
        outerSignal.addEventListener('abort', () => controller.abort(), { once: true })
      }

      try {
        return await baseFetch(input, {
          ...init,
          signal: controller.signal,
        })
      } catch (err) {
        lastErr = err
        const isTimeout = controller.signal.aborted
        const transient = isTransientFetchError(err)
        const isLast = attempt >= SUPABASE_FETCH_RETRY_DELAYS_MS.length - 1

        if (isTimeout && !transient) {
          throw new Error(`Supabase request timed out after ${timeoutMs}ms`, { cause: err })
        }
        if (!transient || isLast) {
          throw err
        }
      } finally {
        clearTimeout(timer)
      }
    }

    throw lastErr
  }
}

/** 미들웨어·서버 Route — Auth/DB 가 멈춰도 페이지가 무한 대기하지 않게 */
export const SUPABASE_SERVER_FETCH_TIMEOUT_MS = 12000
