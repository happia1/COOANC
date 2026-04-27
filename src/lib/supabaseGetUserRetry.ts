import type { SupabaseClient, User } from '@supabase/supabase-js'

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

const RETRY_DELAY_MS = 150

/**
 * `auth.getUser()` — 락 경쟁 시 1회 재시도 후, 그래도 실패하면 `null` (화면은 비로그인처럼 처리).
 */
export async function getAuthUserWithRetry(supabase: SupabaseClient): Promise<User | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        if (isAuthStorageLockError(error) && attempt === 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
          continue
        }
        if (!isAuthStorageLockError(error)) {
          console.warn('[getAuthUserWithRetry] getUser:', error.message)
        }
        return null
      }
      return data.user
    } catch (e) {
      if (isAuthStorageLockError(e) && attempt === 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
        continue
      }
      console.warn('[getAuthUserWithRetry] getUser exception:', e)
      return null
    }
  }
  return null
}
