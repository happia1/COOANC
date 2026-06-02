import type { ChildStats } from '@/types/database'

/**
 * child_stats 정수 컬럼이 숫자·문자열·bigint 로 올 수 있어(클라이언트·PostgREST·Realtime) 모두 안전히 정수로 맞춥니다.
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
 * 레벨 블록·마켓·저금 출처 — `child_stats.credits`(가용 크레딧)
 */
export function creditsAvailable(
  s: Pick<ChildStats, 'credits'> & { credits_wallet?: number; credits_piggy?: number },
): number {
  return readChildStatInt(s.credits)
}

/** 가용 + 저금통 = 아이가 보유한 크레딧 합계 */
export function creditsTotalOwned(
  s: Pick<ChildStats, 'credits'> & { credits_piggy?: number },
): number {
  return readChildStatInt(s.credits) + readChildStatInt(s.credits_piggy)
}

/**
 * @deprecated 예전 「돈바구니(가용)」= credits - wallet - piggy. 새 모델에서는 `creditsAvailable` 과 동일합니다.
 */
export function creditsFloating(
  s: Pick<ChildStats, 'credits'> & { credits_wallet?: number; credits_piggy?: number },
): number {
  const w = readChildStatInt(s.credits_wallet)
  const p = readChildStatInt(s.credits_piggy)
  const c = readChildStatInt(s.credits)
  if (w > 0) return Math.max(0, c)
  void p
  return Math.max(0, c)
}

/**
 * 서버·Realtime 행을 숫자로 맞춥니다.
 * - 예전 데이터(credits=총액, wallet>0)는 읽을 때 가용 크레딧으로 한 번 변환합니다.
 */
export function normalizeChildStatsCreditsSplit<T extends Partial<ChildStats> & { credits: number }>(
  row: T,
): T & { credits: number; credits_wallet: number; credits_piggy: number } {
  const w = readChildStatInt(row.credits_wallet)
  const p = readChildStatInt(row.credits_piggy)
  let credits = readChildStatInt(row.credits)

  if (w > 0) {
    credits = Math.max(0, credits - w - p)
  }

  return { ...row, credits, credits_wallet: 0, credits_piggy: p }
}

export function mergeChildStatsPatch(prev: ChildStats | null, patch: Record<string, unknown>): ChildStats {
  if (!prev) {
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
  out.credits_wallet = 0
  out.credits_piggy =
    'credits_piggy' in patch ? readChildStatInt(patch.credits_piggy) : readChildStatInt(prev.credits_piggy)

  return out as ChildStats
}
