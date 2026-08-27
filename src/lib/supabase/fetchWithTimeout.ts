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
export function wrapFetchWithTimeout(
  baseFetch: typeof fetch,
  timeoutMs = 12000,
  /**
   * 최대 시도 횟수. 기본은 재시도 지연 개수(3회)입니다.
   * Edge 미들웨어처럼 **전체 실행 시간이 짧게 제한된 곳**에서는 1을 넘겨 재시도를 끕니다.
   * (12초 × 3회면 30초가 넘어 Vercel 미들웨어 한도를 초과합니다.)
   */
  maxAttempts: number = SUPABASE_FETCH_RETRY_DELAYS_MS.length,
): typeof fetch {
  const attemptCount = Math.max(1, Math.min(maxAttempts, SUPABASE_FETCH_RETRY_DELAYS_MS.length))
  return async (input, init) => {
    let lastErr: unknown

    for (let attempt = 0; attempt < attemptCount; attempt++) {
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
        const isLast = attempt >= attemptCount - 1

        /** 시간 제한까지 이미 기다린 요청은 다시 2번 반복해 36초 이상 막지 않습니다. */
        if (isTimeout) {
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

/** 서버 Route — Auth/DB 가 멈춰도 페이지가 무한 대기하지 않게 */
export const SUPABASE_SERVER_FETCH_TIMEOUT_MS = 12000

/**
 * Edge 미들웨어 전용 — 훨씬 짧게 잡습니다.
 *
 * 비개발자 설명: 미들웨어는 **모든 화면 요청보다 먼저** 실행됩니다. 여기서 오래 기다리면
 * Vercel 이 요청 자체를 끊어 버려(504 MIDDLEWARE_INVOCATION_TIMEOUT) 사이트 전체가 열리지 않습니다.
 * 그래서 로그인 확인은 짧게만 시도하고, 늦으면 포기하고 화면으로 넘깁니다.
 */
export const SUPABASE_MIDDLEWARE_FETCH_TIMEOUT_MS = 3500
