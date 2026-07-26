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
import { NAV_MAP_UNLOCK_MIN_LEVEL } from '@/constants/navigationMap'

/** 안내용 화분 아이콘 — 꽃이 핀 4단계 그림(싹만 있는 그림보다 무엇을 키우는지 잘 보입니다) */
const PARENT_PLANT_ICON_SRC = '/assets/img/missions/routine/plant/apple/4.png'

/** 안내용 마켓 아이콘 — 자녀 마켓 탭과 같은 장바구니 그림 */
const PARENT_MARKET_ICON_SRC = '/assets/img/common/ui/basket_filled.png'

/** 부모 팝업·안내용 저금통 아이콘 — 자녀 홈과 같은 14단계 PNG 초기 모습 */
const PARENT_PIGGY_BANK_ICON_SRC =
  PIGGY_BANK_STAGE_URLS[0] ?? '/assets/img/items/rewards/piggybank/piggy_bank1.png'

/** 처음부터 쓸 수 있는 기본 기능(레벨 0)과, 레벨을 올려야 열리는 기능을 모두 담습니다 */
export type ParentChildUnlockFeatureId =
  | 'missions'
  | 'navMap'
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
  /**
   * 아이 화면에서 이 기능을 쓰는 순서.
   * 부모가 레벨업 팝업에서 보고 **아이와 함께** 따라 해 볼 수 있도록 만든 설명입니다.
   * (아이는 글을 못 읽을 수 있어, 자세한 안내는 자녀 앱이 아니라 부모 앱에 둡니다.)
   */
  howToSteps: readonly string[]
  /** 부모가 아이와 함께 해 보면 좋은 것 한 문장 */
  withChildTip: string
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
    title: '미션',
    shortLabel: '미션',
    description: '매일 미션을 끝내면 크레딧과 하트를 받아요. 모든 기능의 출발점입니다.',
    iconSrc: '/assets/img/common/ui/map.png',
    howToSteps: [
      '홈 화면에서 오늘의 미션 카드를 확인해요.',
      '미션을 끝내면 카드를 눌러 완료로 표시해요.',
      '크레딧과 하트가 올라요 — 크레딧은 사고 모으는 데, 하트는 화분에 물 주는 데 씁니다.',
    ],
    withChildTip: '첫날은 미션 카드를 함께 읽으며 「이건 언제 할까?」를 정해 보세요.',
  },
  {
    id: 'market',
    minLevel: 0,
    title: '마켓',
    shortLabel: '마켓',
    description: '갖고 싶은 것을 고르면 부모님께 구매 요청이 가고, 승인하면 크레딧이 빠져요.',
    iconSrc: PARENT_MARKET_ICON_SRC,
    howToSteps: [
      '아래 마켓 탭을 열어요.',
      '갖고 싶은 것을 골라 사기를 눌러요.',
      '부모님 앱으로 승인 요청이 오고, 승인하면 크레딧이 빠져요.',
    ],
    withChildTip: '무엇을 언제 살 수 있는지 미리 정해 두면 실랑이가 줄어요.',
  },
  {
    id: 'plant',
    minLevel: 0,
    title: '화분 키우기',
    shortLabel: '화분',
    description: '하트로 물을 주면 싹이 나고 꽃이 펴서 열매가 맺혀요. 모은 열매는 나중에 시장에 팔 수 있게 됩니다.',
    iconSrc: PARENT_PLANT_ICON_SRC,
    howToSteps: [
      '홈 화면의 화분을 눌러 화분 팝업을 열어요.',
      '물조리개를 누르면 하트로 물을 줄 수 있어요(크레딧이 아니라 하트입니다).',
      '하트 게이지가 다 차면 한 단계 자라요 — 싹 → 어린 나무 → 꽃봉오리 → 꽃 → 열매.',
      '열매가 다 익으면 수확하고, 새 씨앗을 심어 다시 키워요.',
    ],
    withChildTip:
      '수확한 열매를 시장에 파는 기능이 준비 중이에요. ' +
      '「열매를 모아 뒀다가 나중에 팔자」고 목표를 정해 두면 돌보는 재미가 커져요.',
  },
  {
    id: 'sticker',
    minLevel: STICKER_UNLOCK_MIN_LEVEL,
    title: '칭찬 스티커',
    shortLabel: '스티커',
    description: '미션을 하면 스티커를 받아 스티커 판에 붙여요. 판을 다 채우면 선물을 약속해요.',
    iconSrc: '/assets/img/common/ui/luckybox.png',
    howToSteps: [
      '미션을 끝내면 칭찬 스티커를 받아요.',
      '화면 오른쪽 위 선물상자를 눌러 스티커 판을 열어요.',
      '스티커를 한 번 누르고, 붙이고 싶은 칸을 누르면 붙어요(끌어다 놓아도 됩니다).',
      '20칸을 다 채우면 새 판으로 다시 시작해요.',
    ],
    withChildTip: '판을 다 채우면 무엇을 받을지 미리 약속해 두세요. 약속이 스티커 한 장의 의미를 만듭니다.',
  },
  {
    id: 'piggyBank',
    minLevel: PIGGY_BANK_UNLOCK_MIN_LEVEL,
    title: '저금통',
    shortLabel: '저금통',
    description: '크레딧을 저금통에 모아 둘 수 있고, 오래 둘수록 이자가 붙어요.',
    iconSrc: PARENT_PIGGY_BANK_ICON_SRC,
    howToSteps: [
      '홈 화면의 저금통을 눌러요.',
      '저금통 그림을 누르면 크레딧이 1개씩 들어가고, 왼쪽 동전을 누르면 도로 나와요.',
      '저금통에 10개 넘게 두면 3일마다 이자가 붙어요(많이 모을수록 이자율이 올라갑니다).',
      '이자는 저금통 위에 반짝이는 코인으로 떠요. 코인을 눌러야 크레딧이 됩니다.',
    ],
    withChildTip: '쓸지 모을지 아이가 직접 고르게 해주세요. 이자 코인은 눌러야 받아지니 함께 확인해 보세요.',
  },
  {
    id: 'contentZone',
    minLevel: CONTENT_ZONE_UNLOCK_MIN_LEVEL,
    title: '보물상자',
    shortLabel: '보물상자',
    description: '크레딧으로 「보물상자 이용권」을 사서 영상 같은 재미있는 콘텐츠를 즐겨요.',
    iconSrc: CHILD_CONTENT_TREASURE_ICON_URL,
    howToSteps: [
      '아래 보물상자를 열어 이용권을 골라요.',
      '이용권을 사면 부모님께 승인 요청이 가요.',
      '승인하면 크레딧이 빠지고, 보물상자 옆에 쓸 수 있는 이용권 수가 숫자로 떠요.',
      '그 이용권으로 영상을 봐요.',
    ],
    withChildTip:
      '몇 개 살지는 아이가 스스로 정하게 해주세요. ' +
      '대신 「산 시간만큼만 이용한다」는 약속을 함께 정하는 것이 핵심이에요.',
  },
  {
    id: 'minigame',
    minLevel: MINIGAME_UNLOCK_LEVEL,
    title: '미니게임',
    shortLabel: '미니게임',
    description: '보물상자에 미니게임이 열려요. 갖고 있던 이용권으로 두뇌발달을 돕는 게임을 할 수 있어요.',
    iconSrc: CONTENT_MINIGAME_TICKET_IMAGE_URL,
    howToSteps: [
      '보물상자를 열어요.',
      '이제 영상과 미니게임 중에서 고를 수 있어요(이용권은 같은 것을 씁니다).',
      '갖고 있는 이용권으로 미니게임을 즐겨요.',
    ],
    withChildTip:
      '같은 이용권을 영상에 쓸지 게임에 쓸지 아이가 고르게 해주세요. ' +
      '저금통과 놀이 사이에서 어떻게 나누는지 지켜보는 것도 좋은 관찰이에요.',
  },
  {
    id: 'navMap',
    minLevel: NAV_MAP_UNLOCK_MIN_LEVEL,
    title: '항해지도',
    shortLabel: '항해지도',
    description: '지금까지의 여정을 지도로 보고, 미션을 꾸준히 하면 배가 앞으로 나아가요.',
    iconSrc: '/assets/img/common/ui/map.png',
    howToSteps: [
      '홈 화면의 캐릭터를 눌러요.',
      '팝업에서 항해지도를 열어요.',
      '하루 미션을 90% 넘게 끝내면 배가 한 칸 앞으로 나아가요.',
    ],
    withChildTip: '아직 준비 중인 기능이에요. 열리면 지금까지 얼마나 왔는지 함께 되짚어 보세요.',
  },
  // 과일·꽃 팔기 — 화분에서 수확한 열매를 시장에 되파는 기능 (미구현, 향후 추가 예정)
  // 감정카드·일기 — 미구현, 향후 추가 예정
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
