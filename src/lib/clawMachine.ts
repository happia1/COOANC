/**
 * 인형뽑기(클로우 머신) 미니게임 — 상품 추첨·히트 판정 순수 로직.
 * API 라우트(`claw-session-start`, `claw-grab`)에서 공용으로 씁니다.
 */

export type ClawPrize =
  | { type: 'hearts'; amount: number }
  | { type: 'credits'; amount: number }
  | { type: 'seed'; treeId: string }
  | { type: 'ticket'; amount: number }
  | { type: 'snack'; storeItemId: string; storeItemName: string; storeItemImageUrl: string | null }

export type ClawSlot = {
  position: number
  prize: ClawPrize
}

export const CLAW_SLOT_COUNT = 6

/** 각 슬롯 가로 폭(%) — 0~100 을 6등분 */
export const CLAW_SLOT_WIDTH_PCT = 100 / CLAW_SLOT_COUNT

/** 히트박스 반경(%) — 슬롯 폭의 75%, 넉넉하게 잡아 인접 슬롯과 겹칠 수 있음 */
export const CLAW_HIT_RADIUS_PCT = CLAW_SLOT_WIDTH_PCT * 0.75

/** 슬롯 i(0~5)의 중심 위치(%) */
export function clawSlotCenterPct(position: number): number {
  return (position + 0.5) * CLAW_SLOT_WIDTH_PCT
}

/**
 * clawPosition(0~100)이 어느 슬롯의 히트박스 안에 있는지 찾습니다.
 * 히트박스가 겹칠 수 있어, 반경 안에 있는 슬롯 중 거리가 가장 가까운 것을 고릅니다.
 */
export function findHitSlot(slots: ClawSlot[], clawPosition: number): ClawSlot | null {
  let best: ClawSlot | null = null
  let bestDist = Infinity
  for (const slot of slots) {
    const dist = Math.abs(clawPosition - clawSlotCenterPct(slot.position))
    if (dist <= CLAW_HIT_RADIUS_PCT && dist < bestDist) {
      best = slot
      bestDist = dist
    }
  }
  return best
}

type PrizeRoll = { type: ClawPrize['type']; weight: number; amount?: number }

/** 가중치 합 100 — 슬롯 1개당 이 표에서 독립적으로 1회 추첨 */
export const CLAW_PRIZE_TABLE: PrizeRoll[] = [
  { type: 'hearts', weight: 30, amount: 3 },
  { type: 'credits', weight: 25, amount: 10 },
  { type: 'credits', weight: 10, amount: 30 },
  { type: 'seed', weight: 15 },
  { type: 'ticket', weight: 10, amount: 1 },
  { type: 'snack', weight: 10 },
]

export function pickWeightedPrizeRoll(): PrizeRoll {
  const r = Math.random() * 100
  let acc = 0
  for (const entry of CLAW_PRIZE_TABLE) {
    acc += entry.weight
    if (r < acc) return entry
  }
  return CLAW_PRIZE_TABLE[CLAW_PRIZE_TABLE.length - 1]!
}

export type CheapSnackCandidate = {
  id: string
  name: string
  imageUrl: string | null
}

/** 씨앗 프라이즈에 쓸 기본 나무 종류(자녀가 아직 씨앗을 안 골랐어도 항상 사과 기준) */
export const CLAW_SEED_PRIZE_TREE_ID = 'apple'

/**
 * 추첨 결과 하나를 실제 ClawPrize 로 바꿉니다.
 * `snack` 타입인데 후보가 없으면 null 을 돌려주고, 호출부에서 다른 타입으로 재추첨해야 합니다.
 */
export function resolvePrizeFromRoll(
  roll: PrizeRoll,
  cheapSnacks: CheapSnackCandidate[],
): ClawPrize | null {
  switch (roll.type) {
    case 'hearts':
      return { type: 'hearts', amount: roll.amount ?? 3 }
    case 'credits':
      return { type: 'credits', amount: roll.amount ?? 10 }
    case 'seed':
      return { type: 'seed', treeId: CLAW_SEED_PRIZE_TREE_ID }
    case 'ticket':
      return { type: 'ticket', amount: roll.amount ?? 1 }
    case 'snack': {
      if (cheapSnacks.length === 0) return null
      const pick = cheapSnacks[Math.floor(Math.random() * cheapSnacks.length)]!
      return {
        type: 'snack',
        storeItemId: pick.id,
        storeItemName: pick.name,
        storeItemImageUrl: pick.imageUrl,
      }
    }
    default:
      return null
  }
}

/** 6칸 레이아웃 생성 — snack 후보가 없으면 해당 슬롯만 다른 타입으로 재추첨 */
export function generateClawLayout(cheapSnacks: CheapSnackCandidate[]): ClawSlot[] {
  const slots: ClawSlot[] = []
  for (let position = 0; position < CLAW_SLOT_COUNT; position++) {
    let prize: ClawPrize | null = null
    let guard = 0
    while (!prize && guard < 10) {
      prize = resolvePrizeFromRoll(pickWeightedPrizeRoll(), cheapSnacks)
      guard += 1
    }
    slots.push({ position, prize: prize ?? { type: 'hearts', amount: 3 } })
  }
  return slots
}
