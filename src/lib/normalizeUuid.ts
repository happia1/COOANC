/**
 * URL 세그먼트로 넘어온 UUID를 RFC 형식(8-4-4-4-12, 하이픈 포함)으로 맞춥니다.
 * - DB·Supabase는 보통 하이픈 포함 문자열을 쓰지만, 어떤 경로에서는 32자리 16진만 올 수 있어
 *   기존 정규식 검사에서 걸려 404가 나는 경우를 막습니다.
 */
export function normalizeUuidParam(raw: string | undefined | null): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const hex = s.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) return null
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
