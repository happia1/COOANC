/**
 * 서버(API 라우트)에서만 사용 — Supabase URL·service_role 키를 여러 이름으로 읽습니다.
 * - 일부 팀은 `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` 만 쓰기도 하고,
 * - 값에 따옴표·BOM 이 붙어 있으면 `trim()` 만으로는 비어 보이지 않아도 파싱이 깨질 수 있어 정리합니다.
 */

function cleanServerEnv(raw: string | undefined): string {
  if (raw == null) return ''
  let s = String(raw).trim()
  if (s.length === 0) return ''
  /** Windows/에디터에서 복사한 UTF-8 BOM */
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim()
  /** `.env` 에 따옴표를 넣은 경우 일부 로더가 그대로 넘길 수 있음 */
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim()
  }
  return s
}

/**
 * `createClient(url, serviceRoleKey)` 에 쓸 URL·키.
 * @returns 둘 다 비어 있지 않을 때만 객체, 아니면 null
 */
export function resolveSupabaseServiceRoleEnv(): { url: string; key: string } | null {
  const url =
    cleanServerEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || cleanServerEnv(process.env.SUPABASE_URL)
  const key =
    cleanServerEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    cleanServerEnv(process.env.SUPABASE_SERVICE_KEY)
  if (!url || !key) return null
  return { url, key }
}
