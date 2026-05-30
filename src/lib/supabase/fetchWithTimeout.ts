/**
 * Supabase HTTP 요청에 상한 시간을 둡니다.
 * 비개발자: Supabase 가 느리거나 멈춰 있을 때 앱이 5분 넘게 빈 화면만 보이지 않게,
 * 일정 시간(기본 8초) 지나면 포기하고 로그인 화면 등으로 넘어가게 합니다.
 */
export function wrapFetchWithTimeout(baseFetch: typeof fetch, timeoutMs = 8000): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await baseFetch(input, {
        ...init,
        signal: controller.signal,
      })
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`Supabase request timed out after ${timeoutMs}ms`, { cause: err })
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
}

/** 미들웨어·서버 Route — Auth/DB 가 멈춰도 페이지가 무한 대기하지 않게 8초 */
export const SUPABASE_SERVER_FETCH_TIMEOUT_MS = 8000
