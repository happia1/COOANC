import type { ChildStats } from '@/types/database'

/**
 * child_stats 정수 컬럼이 숫자·문자열·bigint 로 올 수 있어(클라이언트·PostgREST·Realtime) 모두 안전히 정수로 맞춥니다.
 * - API 가 `typeof === 'number'` 만 보면 문자열 지갑 잔액을 0으로 읽어 「화면과 옮기기 검증」이 어긋날 수 있습니다.
 */
export function readChildStatInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const t = value.trim()
    if (t === '') return 0
    const n = Number(t)
    return Number.isFinite(n) ? Math.trunc(n) : 0
  }
  return 0
}

/**
 * 총 크레딧 중 지갑·저금통에 아직 나누지 않은 양 = 미션 섬 「잔디 위 동전」으로 보여 줍니다.
 * 미션 보상은 총액만 오르고 지갑/저금통은 그대로라서, 새 크레딧은 여기(가용)에 먼저 쌓입니다.
 */
export function creditsFloating(
  s: Pick<ChildStats, 'credits'> & { credits_wallet?: number; credits_piggy?: number },
): number {
  const c = readChildStatInt(s.credits)
  const w = readChildStatInt(s.credits_wallet)
  const p = readChildStatInt(s.credits_piggy)
  return Math.max(0, c - w - p)
}

/**
 * 서버에서 받은 행을 숫자로 맞춥니다.
 * - wallet/piggy 가 없으면 **0** (전부 잔디 가용으로 간주). 예전처럼 `credits` 전체를 지갑으로 보지 않습니다.
 */
export function normalizeChildStatsCreditsSplit<T extends Partial<ChildStats> & { credits: number }>(
  row: T,
): T & { credits: number; credits_wallet: number; credits_piggy: number } {
  const credits = readChildStatInt(row.credits)
  const w = readChildStatInt(row.credits_wallet)
  const p = readChildStatInt(row.credits_piggy)
  return { ...row, credits, credits_wallet: w, credits_piggy: p }
}

/**
 * Realtime `payload.new` 처럼 **일부 컬럼만** 올 때, 지갑·저금통이 빠지면 이전 값을 유지합니다.
 * (빠진 채로 normalize 하면 지갑=credits 로 잡혀 잔디 보상이 지갑으로 보이던 문제를 막습니다.)
 */
export function mergeChildStatsPatch(prev: ChildStats | null, patch: Record<string, unknown>): ChildStats {
  if (!prev) {
    /** Realtime 첫 페이로드는 전체 행이 오는 경우가 많아 `patch` 를 `ChildStats` 로 취급 */
    return normalizeChildStatsCreditsSplit({
      ...(patch as Partial<ChildStats>),
      credits: readChildStatInt(patch.credits),
      credits_wallet: readChildStatInt(patch.credits_wallet),
      credits_piggy: readChildStatInt(patch.credits_piggy),
    }) as ChildStats
  }

  const out: Record<string, unknown> = { ...prev }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) continue
    out[key] = value
  }

  out.credits = 'credits' in patch ? readChildStatInt(patch.credits) : readChildStatInt(prev.credits)
  out.credits_wallet =
    'credits_wallet' in patch ? readChildStatInt(patch.credits_wallet) : readChildStatInt(prev.credits_wallet)
  out.credits_piggy =
    'credits_piggy' in patch ? readChildStatInt(patch.credits_piggy) : readChildStatInt(prev.credits_piggy)

  return out as ChildStats
}
