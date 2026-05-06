import type { AuthError, SupabaseClient, User } from '@supabase/supabase-js'
import { runSerializedBrowserAuthOp } from '@/lib/supabase/browserAuthQueue'

/**
 * 브라우저 Supabase Auth가 storage(Web Locks 등)에 접근할 때, 동시 요청으로
 * "Lock was released because another request stole it" / AbortError 가 날 수 있습니다.
 * — 한 번 짧게 대기 후 `getUser` 를 다시 시도합니다.
 * (비개발자: 로그인 정보를 읽는 창이 동시에 여러 개 열리지 않게 하려다 생기는 경쟁을 완화합니다.)
 */
function isAuthStorageLockError(e: unknown): boolean {
  if (e instanceof DOMException) {
    if (e.name === 'AbortError') return true
    if (/[Ll]ock|steal|stole/i.test(e.message)) return true
  }
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = String((e as { message: unknown }).message)
    if (/[Ll]ock|steal|stole|AbortError/i.test(msg)) return true
  }
  return false
}

/** Supabase Auth 가 네트워크 끊김·CORS 등으로 `Failed to fetch` 를 줄 때 — 잠깐 뒤 다시 시도합니다. */
function isTransientNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError && /fetch|network|load failed/i.test(String(e.message))) return true
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = String((e as { message: unknown }).message)
    if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) return true
  }
  return false
}

function isTransientNetworkAuthError(error: AuthError): boolean {
  return isTransientNetworkFailure(error)
}

const LOCK_RETRY_DELAY_MS = 150
/** 네트워크 재시도마다 조금씩 길게 기다립니다(밀리초). */
const NETWORK_BACKOFF_MS = [200, 400, 600, 1000]
const MAX_ATTEMPTS = 6

function delayForAttempt(attempt: number, reason: 'lock' | 'network'): Promise<void> {
  const ms =
    reason === 'lock'
      ? LOCK_RETRY_DELAY_MS
      : NETWORK_BACKOFF_MS[Math.min(attempt, NETWORK_BACKOFF_MS.length - 1)]!
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * `auth.getUser()` — 스토리지 락·일시적 네트워크 오류 시 여러 번 재시도한 뒤,
 * 그래도 실패하면 `null` (화면은 비로그인처럼 처리).
 * 브라우저에서는 `browserAuthQueue` 로 다른 Auth 호출과 겹치지 않게 합니다.
 */
export async function getAuthUserWithRetry(supabase: SupabaseClient): Promise<User | null> {
  return runSerializedBrowserAuthOp(async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) {
          const lock = isAuthStorageLockError(error)
          const net = isTransientNetworkAuthError(error)
          if ((lock || net) && attempt < MAX_ATTEMPTS - 1) {
            await delayForAttempt(attempt, net ? 'network' : 'lock')
            continue
          }
          if (!lock && !net) {
            console.warn('[getAuthUserWithRetry] getUser:', error.message)
          }
          return null
        }
        return data.user
      } catch (e) {
        const lock = isAuthStorageLockError(e)
        const net = isTransientNetworkFailure(e)
        if ((lock || net) && attempt < MAX_ATTEMPTS - 1) {
          await delayForAttempt(attempt, net ? 'network' : 'lock')
          continue
        }
        console.warn('[getAuthUserWithRetry] getUser exception:', e)
        return null
      }
    }
    return null
  })
}
