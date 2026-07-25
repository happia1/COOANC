/**
 * 부모 앱 — 「지금 우리 아이 레벨은 어떤 단계이고, 무엇을 할 수 있는지」 안내 내용을 만듭니다.
 *
 * 비개발자 설명:
 * - 부모 홈의 「다가오는 일정」 바로 위 블록과, 상단 알림창(공지센터)에서 같은 내용을 씁니다.
 * - 문구는 기존 정의를 그대로 재사용합니다.
 *     레벨별 부모 안내 → `constants/childGrowthLevels.ts` 의 `PARENT_GUIDES`
 *     기능 해금 목록   → `lib/parentChildLevelUnlocks.ts` 의 `PARENT_CHILD_UNLOCK_MILESTONES`
 *   문구를 고치려면 그 두 파일만 보면 됩니다.
 */

import {
  getChildBadge,
  getChildZone,
  getParentGuide,
  type ChildBadgeEntry,
  type ChildZone,
} from '@/constants/childGrowthLevels'
import {
  PARENT_CHILD_UNLOCK_MILESTONES,
  type ParentChildUnlockMilestone,
} from '@/lib/parentChildLevelUnlocks'

export type ParentChildLevelGuide = {
  level: number
  /** 정원·마을·항구·바다 */
  zone: ChildZone
  /** 이 레벨에서 딱 받는 칭호(없는 레벨이면 null) */
  badge: ChildBadgeEntry | null
  /** 지금까지 받은 칭호 중 가장 최근 것 — 헤더 라벨용 */
  currentBadge: ChildBadgeEntry | null
  /** 이 레벨의 부모 안내 문구 — 표에 없는 레벨은 공통 문구가 들어와 항상 값이 있습니다 */
  guideText: string
  /** 지금 자녀 앱에서 쓸 수 있는 기능 */
  openedFeatures: ParentChildUnlockMilestone[]
  /** 이번 레벨에 새로 열린 기능(없으면 빈 배열) */
  justOpenedFeatures: ParentChildUnlockMilestone[]
  /** 다음에 열릴 기능(없으면 null) */
  nextFeature: ParentChildUnlockMilestone | null
  /** 다음 기능까지 남은 레벨 수(없으면 0) */
  levelsToNextFeature: number
}

/** 레벨 → 부모에게 보여 줄 안내 묶음 */
export function buildParentChildLevelGuide(levelRaw: number): ParentChildLevelGuide {
  const level = Number.isFinite(levelRaw) ? Math.max(0, Math.floor(levelRaw)) : 0

  const opened = PARENT_CHILD_UNLOCK_MILESTONES.filter((m) => level >= m.minLevel)
  const next = PARENT_CHILD_UNLOCK_MILESTONES.find((m) => m.minLevel > level) ?? null

  /** 지금까지 받은 칭호 중 가장 최근 것(레벨 6이면 5레벨의 「저축왕」) */
  let currentBadge: ChildBadgeEntry | null = null
  for (let l = level; l >= 0; l -= 1) {
    const b = getChildBadge(l)
    if (b) {
      currentBadge = b
      break
    }
  }

  return {
    level,
    zone: getChildZone(level),
    badge: getChildBadge(level),
    currentBadge,
    guideText: getParentGuide(level),
    openedFeatures: opened,
    justOpenedFeatures: PARENT_CHILD_UNLOCK_MILESTONES.filter((m) => m.minLevel === level),
    nextFeature: next,
    levelsToNextFeature: next ? next.minLevel - level : 0,
  }
}

/**
 * 알림창에서 「지난 레벨 안내」를 훑어볼 수 있도록, 0레벨부터 현재 레벨까지의 안내를 모읍니다.
 * 문구가 없는 레벨은 건너뜁니다. 최신 레벨이 맨 앞입니다.
 */
export function buildParentChildLevelGuideHistory(
  levelRaw: number,
): { level: number; guideText: string }[] {
  const level = Number.isFinite(levelRaw) ? Math.max(0, Math.floor(levelRaw)) : 0
  const rows: { level: number; guideText: string }[] = []
  for (let l = level; l >= 0; l -= 1) {
    const text = getParentGuide(l)
    if (text) rows.push({ level: l, guideText: text })
  }
  return rows
}
