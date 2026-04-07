import type { ChildStats } from '@/types/database'

/**
 * 총 크레딧 중 지갑·저금통에 아직 나누지 않은 양 = 미션 섬 「잔디 위 동전」으로 보여 줍니다.
 * 미션 보상은 총액만 오르고 지갑/저금통은 그대로라서, 새 크레딧은 여기(가용)에 먼저 쌓입니다.
 */
export function creditsFloating(
  s: Pick<ChildStats, 'credits'> & { credits_wallet?: number; credits_piggy?: number },
): number {
  const w = typeof s.credits_wallet === 'number' ? s.credits_wallet : 0
  const p = typeof s.credits_piggy === 'number' ? s.credits_piggy : 0
  return Math.max(0, s.credits - w - p)
}

/**
 * 서버에서 받은 행을 숫자로 맞춥니다.
 * - wallet/piggy 가 없으면 **0** (전부 잔디 가용으로 간주). 예전처럼 `credits` 전체를 지갑으로 보지 않습니다.
 */
export function normalizeChildStatsCreditsSplit<T extends Partial<ChildStats> & { credits: number }>(
  row: T,
): T & { credits_wallet: number; credits_piggy: number } {
  const w = typeof row.credits_wallet === 'number' ? row.credits_wallet : 0
  const p = typeof row.credits_piggy === 'number' ? row.credits_piggy : 0
  return { ...row, credits_wallet: w, credits_piggy: p }
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/**
 * Realtime `payload.new` 처럼 **일부 컬럼만** 올 때, 지갑·저금통이 빠지면 이전 값을 유지합니다.
 * (빠진 채로 normalize 하면 지갑=credits 로 잡혀 잔디 보상이 지갑으로 보이던 문제를 막습니다.)
 */
export function mergeChildStatsPatch(prev: ChildStats | null, patch: Record<string, unknown>): ChildStats {
  if (!prev) {
    return normalizeChildStatsCreditsSplit({
      ...(patch as Partial<ChildStats>),
      credits: num(patch.credits) ?? 0,
      credits_wallet: num(patch.credits_wallet),
      credits_piggy: num(patch.credits_piggy),
    })
  }

  const out: Record<string, unknown> = { ...prev }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) continue
    out[key] = value
  }

  if (num(patch.credits) !== undefined) {
    out.credits = num(patch.credits)
  }
  if (!('credits_wallet' in patch) || num(patch.credits_wallet) === undefined) {
    out.credits_wallet = typeof prev.credits_wallet === 'number' ? prev.credits_wallet : 0
  } else {
    out.credits_wallet = num(patch.credits_wallet)
  }
  if (!('credits_piggy' in patch) || num(patch.credits_piggy) === undefined) {
    out.credits_piggy = typeof prev.credits_piggy === 'number' ? prev.credits_piggy : 0
  } else {
    out.credits_piggy = num(patch.credits_piggy)
  }

  return out as ChildStats
}
