/**
 * 부모 앱 — 자녀 레벨업 시 「새로 열린 기능」 안내용 정의
 *
 * 비개발자 설명:
 * - 자녀 앱 `childScreenFeatures.ts` 와 같은 레벨 기준을 씁니다.
 * - 아이가 4→5레벨이 되면 「저금통」이 새로 열렸다고 부모 팝업에 보여 줍니다.
 */

import {
  getChildBadge,
  getChildZone,
  getParentGuide,
} from '@/constants/childGrowthLevels'

export { getChildBadge, getChildZone, getParentGuide }

import {
  CONTENT_ZONE_UNLOCK_MIN_LEVEL,
  STICKER_UNLOCK_MIN_LEVEL,
} from '@/constants/childScreenFeatures'
import { PIGGY_BANK_UNLOCK_MIN_LEVEL } from '@/constants/childAgeConfig'
import {
  CHILD_CONTENT_TREASURE_ICON_URL,
  CONTENT_MINIGAME_TICKET_IMAGE_URL,
  MINIGAME_UNLOCK_LEVEL,
} from '@/constants/childContentMenu'
import { PIGGY_BANK_STAGE_URLS } from '@/constants/piggyBankStages'

/** 부모 팝업·안내용 저금통 아이콘 — 자녀 홈과 같은 14단계 PNG 초기 모습 */
const PARENT_PIGGY_BANK_ICON_SRC =
  PIGGY_BANK_STAGE_URLS[0] ?? '/assets/img/items/rewards/piggybank/piggy_bank1.png'

/** 처음부터 쓸 수 있는 기본 기능(레벨 0)과, 레벨을 올려야 열리는 기능을 모두 담습니다 */
export type ParentChildUnlockFeatureId =
  | 'missions'
  | 'market'
  | 'plant'
  | 'sticker'
  | 'piggyBank'
  | 'contentZone'
  | 'minigame'

export type ParentChildUnlockMilestone = {
  id: ParentChildUnlockFeatureId
  minLevel: number
  /** 팝업 카드 제목 */
  title: string
  /** 아이콘 아래 짧은 라벨 */
  shortLabel: string
  /** 한 줄 설명 */
  description: string
  iconSrc: string
}

/**
 * 레벨 순 — 부모 안내에 표시할 기능 목록.
 *
 * `minLevel: 0` 인 항목은 「처음부터 쓸 수 있는 기본 기능」입니다.
 * 레벨업 팝업(`unlocksNewlyOpenedBetweenLevels`)은 `minLevel > prevLevel` 만 고르므로,
 * 0레벨 항목이 「새로 열렸어요」 팝업으로 뜨는 일은 없습니다.
 */
export const PARENT_CHILD_UNLOCK_MILESTONES: readonly ParentChildUnlockMilestone[] = [
  {
    id: 'missions',
    minLevel: 0,
    title: '미션·항해지도',
    shortLabel: '미션',
    description: '매일 미션을 끝내면 크레딧과 하트를 받고, 항해지도의 배가 앞으로 나가요.',
    iconSrc: '/assets/img/common/ui/map.png',
  },
  {
    id: 'market',
    minLevel: 0,
    title: '마켓',
    shortLabel: '마켓',
    description: '갖고 싶은 것을 고르면 부모님께 구매 요청이 가고, 승인하면 크레딧이 빠져요.',
    iconSrc: `/assets/img/common/ui/${encodeURIComponent('크레딧.png')}`,
  },
  {
    id: 'plant',
    minLevel: 0,
    title: '화분 키우기',
    shortLabel: '화분',
    description: '하트로 물을 주면 화분이 자라요. 보상 없이 돌보는 경험을 합니다.',
    iconSrc: '/assets/img/common/ui/basket_filled.png',
  },
  {
    id: 'sticker',
    minLevel: STICKER_UNLOCK_MIN_LEVEL,
    title: '칭찬 스티커',
    shortLabel: '스티커',
    description: '미션을 하면 스티커를 받고, 곰돌이 판에 붙일 수 있어요.',
    iconSrc: '/assets/img/common/ui/luckybox.png',
  },
  {
    id: 'piggyBank',
    minLevel: PIGGY_BANK_UNLOCK_MIN_LEVEL,
    title: '저금통',
    shortLabel: '저금통',
    description: '완료 보상 코인을 저금통에 모을 수 있어요.',
    iconSrc: PARENT_PIGGY_BANK_ICON_SRC,
  },
  {
    id: 'contentZone',
    minLevel: CONTENT_ZONE_UNLOCK_MIN_LEVEL,
    title: '보물상자',
    shortLabel: '보물상자',
    description: '모은 크레딧으로 영상 이용권을 직접 살 수 있어요.',
    iconSrc: CHILD_CONTENT_TREASURE_ICON_URL,
  },
  {
    id: 'minigame',
    minLevel: MINIGAME_UNLOCK_LEVEL,
    title: '미니게임',
    shortLabel: '미니게임',
    description: '보물상자에 미니게임 이용권이 추가돼요. 크레딧으로 사서 즐길 수 있어요.',
    iconSrc: CONTENT_MINIGAME_TICKET_IMAGE_URL,
  },
  // 감정카드·일기 — minLevel: 10, 단계명: 탐험가 (미구현, 향후 추가 예정)
  // 과일·꽃 팔기  — minLevel: 12, 단계명: 선장   (미구현, 향후 추가 예정)
] as const

/**
 * `prevLevel` → `newLevel` 사이에 **이번에** 처음 열린 기능만 반환합니다.
 * - 한 단계씩 올랐을 때만 (예: 4→5 저금통, 7→8 보물상자)
 * - 여러 레벨을 한꺼번에 따라잡는 경우(앱 미접속 등)에는 이미 지난 해금을 다시 보여주지 않음
 */
export function unlocksNewlyOpenedBetweenLevels(
  prevLevel: number,
  newLevel: number,
): ParentChildUnlockMilestone[] {
  if (newLevel <= prevLevel) return []
  if (newLevel - prevLevel > 1) return []
  return PARENT_CHILD_UNLOCK_MILESTONES.filter(
    (m) => m.minLevel > prevLevel && m.minLevel <= newLevel,
  )
}

export function parentLevelNotifiedStorageKey(childId: string): string {
  return `cooanc:parent-level-notified:${childId}`
}

export function readParentLastNotifiedLevel(childId: string): number {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(parentLevelNotifiedStorageKey(childId))
  const n = raw != null ? Number.parseInt(raw, 10) : 0
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function writeParentLastNotifiedLevel(childId: string, level: number): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(parentLevelNotifiedStorageKey(childId), String(Math.max(0, level)))
}
