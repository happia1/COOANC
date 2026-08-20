'use client'

/**
 * ChildScreen — 자녀 앱 단일 화면
 *
 * 3탭(홈·미션·마켓)을 하나의 풀스크린 화면으로 통합합니다.
 *
 * 비개발자 설명:
 * - 배경 이미지 위에 캐릭터가 서 있고, 하단에 오늘의 미션 카드가 가로로 스크롤됩니다.
 * - 우측 상단 스택(나가기·스티커·장바구니)은 문·스티커·장바구니가 조금 더 큰 타일(44px)과 그림(28~32px)으로 보입니다. 마켓 패널은 아래에서 올라옵니다.
 * - 상단 오른쪽 나가기(유리 버튼)를 누르면 부모 화면으로 나갑니다.
 * - 새로고침은 레벨·크레딧 유리 카드 **안 오른쪽 아래** 아주 연한 회색 아이콘으로만 둡니다(전체 페이지를 다시 불러 꼬임을 풀 때 씁니다).
 * - 뽀모도로(왼쪽)·음악(오른쪽)은 레벨 블록 바로 아래 한 줄에 배치합니다.
 * - 발 옆: **저금통**은 예전 화분 자리(`plantPct`), **화분**은 예전 물조리개 자리(`canPct`) — 간격은 과거 화분·물조리개 간격과 동일 규칙입니다.
 * - 물조리개는 화분 팝업 안으로 들어 갔습니다.
 * 레이아웃 레이어(아래 → 위):
 *   L1. 배경 이미지 (tablet_kidsroom_background_portrait.png)
 *   L2. 캐릭터 스프라이트 (앵커포인트 기반 배치)
 *   L3. UI 오버레이 (상단: 레벨 카드·카드 안 새로고침·크레딧·하트, 발 옆 저금통·화분, 우측 나가기~장바구니 + 미션 섹션)
 *   L4. 패널 오버레이 (마켓: 항상 하단 슬라이드 / 꾸미기: 세로는 하단·가로는 우측 / 스티커는 별도 시트)
 */

import dynamic from 'next/dynamic'
import { Fragment, useRef, useState, useCallback, useMemo, useEffect, memo } from 'react'
import { flushSync } from 'react-dom'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import RapidTapConfirmModal from '@/components/child/RapidTapConfirmModal'
import MissionHonestyBlockedModal, {
  type MissionHonestyBlockReason,
} from '@/components/child/MissionHonestyBlockedModal'
import ParentMissionRedoNoticeModal from '@/components/child/ParentMissionRedoNoticeModal'
import SpriteImage from '@/components/common/SpriteImage'
import { CharacterSprite } from '@/components/sprites/CharacterSprite'
import {
  BUNNY_HOME_DISPLAY_SCALE,
  CHICK_HOME_ISLAND_CLIP_LEFT_PX,
  OTTER_HOME_DISPLAY_SCALE,
  resolveHomeIslandStageSprite,
} from '@/lib/childHomeCharacterFromAvatar'
import { BACKGROUND_ANCHORS } from '@/constants/backgroundAnchors'
import { ICONS } from '@/constants/sprites'
import { getUnlockedFeatures, STICKER_UNLOCK_MIN_LEVEL, CONTENT_ZONE_UNLOCK_MIN_LEVEL } from '@/constants/childScreenFeatures'
import { usePlantPot } from '@/hooks/usePlantPot'
import { useContainerSize } from '@/hooks/useContainerSize'
import ChildMissionCard from '@/components/child/ChildMissionCard'
import { useChildEnterTransition } from '@/components/child/ChildEnterTransitionProvider'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'
import { PARENT_EXIT_CHILD_UI_JSON_HREF } from '@/lib/parentExitChildUi'
import ChildPanelOverlay, { type PanelType } from '@/components/child/ChildPanelOverlay'
import ChildLevelStatsCard from '@/components/child/ChildLevelStatsCard'
import ChildHomePiggyBank from '@/components/child/ChildHomePiggyBank'
import {
  creditsAvailable,
  normalizeChildStatsCreditsSplit,
  mergeChildStatsPatch,
  readChildStatInt,
} from '@/lib/childCreditsSplit'
import { PIGGY_BANK_UNLOCK_MIN_LEVEL, isPiggyBankUnlocked } from '@/constants/childAgeConfig'
import { completionRateToHearts } from '@/lib/missionHeartCount'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'
import { isSpecialSectionMission, isOrphanSpecialMissionTemplate } from '@/lib/specialMissionChips'
import {
  compareRoutineFlowSortable,
  dedupeDailyRoutineMissionsByCanonicalKey,
  isRetiredRoutineMissionTitle,
  type RoutineFlowSortable,
} from '@/lib/routineChips'
import { mergePraiseStickerGrantsFromServer } from '@/lib/mergePraiseStickerGrantsFromServer'
import {
  CHILD_HOME_TOP_BAR_GLASS_CLASS,
  CHILD_HOME_TOP_BAR_GLASS_STYLE,
} from '@/lib/childHomeTopBarGlass'
import { ASSETS, CHILD_HOME_BACKGROUND_CACHE_BUST } from '@/constants/assets'
import { getPlantPotHomeShellTransform } from '@/constants/plantPotVisual'
import { needsPotSeedSelection, type PlantStage } from '@/constants/plantTrees'
import type { PlantHarvestCelebrate } from '@/lib/plantHarvest'
import { usePlantHarvest } from '@/hooks/usePlantHarvest'
import type {
  ChildStats,
  DailyMissionWithTemplate,
  StoreItem,
  PurchaseRequest,
  PraiseStickerGrant,
  PraiseStickerPlacement,
  ContentChannel,
  ContentCategory,
  ContentSession,
} from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { fireMissionCardConfetti } from '@/lib/missionCardConfetti'
import { tryApplyCompletePayload } from '@/lib/applyDailyMissionCompleteStats'
import AllMissionCompleteOverlay from '@/components/child/AllMissionCompleteOverlay'
import PraiseGiftArrivalModal from '@/components/child/PraiseGiftArrivalModal'
import ChildAlarmClockPopup from '@/components/child/ChildAlarmClockPopup'
import ChildMusicPopup from '@/components/child/ChildMusicPopup'
const ChildContentZonePopup = dynamic(() => import('@/components/child/ChildContentZonePopup'), {
  ssr: false,
})
import { remainingContentSeconds, toYouTubeContentEmbedUrl } from '@/lib/youtubeContent'
import { CHILD_CONTENT_TREASURE_ICON_URL } from '@/constants/childContentMenu'
import PlantPot from '@/components/child/PlantPot'
import PlantStageCelebrationModal from '@/components/child/PlantStageCelebrationModal'
import SleepModeScreen from '@/components/child/SleepModeScreen'
import MorningWakeScreen from '@/components/child/MorningWakeScreen'
import SleepReadyPopup from '@/components/child/SleepReadyPopup'
import SchoolTimePopup from '@/components/child/SchoolTimePopup'
import PiggyBankUnlockFlowModal from '@/components/child/PiggyBankUnlockFlowModal'
import StickerUnlockFlowModal from '@/components/child/StickerUnlockFlowModal'
import ContentZoneUnlockFlowModal from '@/components/child/ContentZoneUnlockFlowModal'
import DiaryModal from '@/components/child/DiaryModal'
import type { DiaryChildProfile } from '@/types/diaryModal'
import { probeDiaryBackgroundAvailable } from '@/lib/diaryBackground'
import {
  isAllowedChildProfileAvatarUrl,
  publicUrlForChildProfileAvatar,
} from '@/lib/childProfileAvatar'
import { readRoutineAlarmPrefs, restoreRoutineAlarmStorage } from '@/lib/routineAlarmLocalPrefs'
import { resolveRoutineAlarmSoundUrl } from '@/lib/routineAlarmSounds'
import { installChildRoutineAudioUnlockOnFirstGesture } from '@/lib/childAudio'
import {
  toYyyyMmDdDbValue,
  dbValueMeansIncomplete,
  getSeoulDateString,
  getSeoulTimeHHMM,
  getSeoulWeekdayShort,
  getMsUntilNextSeoulMidnight,
} from '@/lib/koreaDate'
import { isAfternoonMission } from '@/lib/missionAmPm'
import { settlePiggyBonus } from '@/lib/piggyBankBonus'
import {
  isBedtimeMissionBlockedBeforeSleepReadyWindow,
  isSeoulTimeBeforeNoon,
} from '@/lib/missionHonestyTiming'

/**
 * 미션 완료 직후 API 응답을 기다리지 않고 상단 숫자(하트·크레딧)를 먼저 올립니다.
 * 실패 시 같은 양만큼 빼서 되돌립니다(경험치·레벨은 서버 응답으로만 맞춤).
 *
 * 비개발자: "인터넷이 느려도 보상 숫자는 바로 올라가요. 저장이 실패하면 숫자도 다시 내려가요."
 */
function applyOptimisticMissionMoneyRewards(prev: ChildStats, creditReward: number, heartReward: number): ChildStats {
  return normalizeChildStatsCreditsSplit({
    ...prev,
    hearts: readChildStatInt(prev.hearts) + heartReward,
    credits: readChildStatInt(prev.credits) + creditReward,
    total_credits_earned: readChildStatInt(prev.total_credits_earned) + creditReward,
  } as ChildStats)
}

function rollbackOptimisticMissionMoneyRewards(
  prev: ChildStats,
  creditReward: number,
  heartReward: number,
): ChildStats {
  return normalizeChildStatsCreditsSplit({
    ...prev,
    hearts: Math.max(0, readChildStatInt(prev.hearts) - heartReward),
    credits: Math.max(0, readChildStatInt(prev.credits) - creditReward),
    total_credits_earned: Math.max(0, readChildStatInt(prev.total_credits_earned) - creditReward),
  } as ChildStats)
}

/**
 * 미션 완료로 상단 숫자(크레딧·하트)를 올린 뒤 이 시간(ms) 동안은,
 * 아직 커밋 전 값을 담은 느린 `/home` 재조회(서버 프롭)가 stats 를 덮어써서
 * 크레딧이 되돌아가 보이는 롤백을 막습니다.
 */
const STALE_STATS_GUARD_MS = 6000

/** 이 시간이 지나도 미션 카드가 없으면 그때 「아직 미션이 없어요」로 확정합니다 */
const MISSION_EMPTY_CONFIRM_MS = 2500

/** 화분 단계 상승(물주기로 stage+1) 시 재생할 효과음 */
const PLANT_STAGE_UP_SOUND_SRC =
  '/assets/audio/missions/get_badge-christmas-reveal-tones-2988.wav' as const

/** 저금통 해금 팝업/튜토리얼 재노출 방지용 로컬 키 */
function piggyUnlockSeenStorageKey(childId: string): string {
  return `cooanc:piggy-unlock-seen:${childId}`
}
function piggyTutorialSkipStorageKey(childId: string): string {
  return `cooanc:piggy-tutorial-skip:${childId}`
}
function stickerUnlockSeenStorageKey(childId: string): string {
  return `cooanc:sticker-unlock-seen:${childId}`
}
function stickerTutorialSkipStorageKey(childId: string): string {
  return `cooanc:sticker-tutorial-skip:${childId}`
}
function contentZoneUnlockSeenStorageKey(childId: string): string {
  return `cooanc:content-zone-unlock-seen:${childId}`
}

/**
 * 상단 레벨 카드 반응형 배율 (최대 1.7배) — 실측 너비 기준.
 *
 * 비개발자 설명:
 * - 예전에는 브라우저 전체 너비(100vw)만 보았는데, 일반 폰(~390px)에서는 확대폭이 3% 미만이라
 *   육안으로 거의 안 보였습니다.
 * - 지금은 자녀 홈 화면을 감싼 실제 박스 너비(전체 화면 컨테이너, ResizeObserver)로 계산합니다.
 * - 세로 모드처럼 가로가 좁으면 1배를 유지하고, 가로가 넓어질수록 최대 1.7배까지 부드럽게 커집니다.
 *
 * 배율 구간:
 * - BASE_W 이하 → 1배
 * - FULL_W 이상 → 1.7배
 * - 그 사이 → 선형 보간
 */
const LEVEL_BLOCK_SCALE_BASE_W = 400
const LEVEL_BLOCK_SCALE_FULL_W = 820
const LEVEL_BLOCK_SCALE_MAX = 1.7

/** 문·스티커·장바구니 묶음 — 레벨 카드와 같은 가로 구간에서 선형 확대, 넓은 화면에서 최대 ~2배까지 */
const RIGHT_ICON_PRIMARY_SCALE_BASE_W = LEVEL_BLOCK_SCALE_BASE_W
const RIGHT_ICON_PRIMARY_SCALE_FULL_W = LEVEL_BLOCK_SCALE_FULL_W
const RIGHT_ICON_PRIMARY_SCALE_MAX = 1.95


/** 캐릭터(무대) — 가로가 넓어질수록 최대 2배까지 확대 */
const CHARACTER_UI_SCALE_MAX = 2
/** 토끼 캐릭터만 별도 상한 — 요청 반영: 최대 1.35배 */
const BUNNY_CHARACTER_UI_SCALE_MAX = 1.35
/** 수달 캐릭터만 별도 상한 — 요청 반영: 최대 1.5배 */
const OTTER_CHARACTER_UI_SCALE_MAX = 1.5
/** 토끼·수달 외 캐릭터 상한 — 요청 반영: 최대 1.3배 */
const OTHER_CHARACTER_UI_SCALE_MAX = 1.3
/** 병아리 캐릭터 상한 — 요청 반영: 최대 1배 */
const CHICK_CHARACTER_UI_SCALE_MAX = 1
/** 병아리 캐릭터 하한 — 요청 반영: 최소 2/3배 */
const CHICK_CHARACTER_UI_SCALE_MIN = 2 / 3
/** 햄스터 캐릭터 상한 — 요청 반영: 최대 1.1배 */
const HAMSTER_CHARACTER_UI_SCALE_MAX = 1.1
/** 햄스터 캐릭터 하한 — 요청 반영: 최소 2/3배 */
const HAMSTER_CHARACTER_UI_SCALE_MIN = 2 / 3

/** 화분·물조리개(발 옆) 크기 배율 상한 — 400px→820px 구간에서 1.0→이 값으로 커집니다(≤400px 는 1.0 고정, 모바일 크기 불변). iPad Air(820) 이상에서 저금통/화분을 키우려 상향. */
const PLANT_FEET_UI_SCALE_MAX = 1.7

/**
 * 발 옆 화분·물조리개의 **표시 크기**와 **토끼와의 가로 간격(px)** 을 맞출 때 쓰는 기준 가로(px).
 * 비개발자: 가로 885일 때 화분·물조리개 크기(배율)와, 토끼 발치 기준 가로 간격을 그대로 유지합니다.
 */
const PLANT_FEET_LAYOUT_REFERENCE_W = 885
/** 데스크톱/태블릿(≥640px, iPad Air 820 포함)에서 화분·물조리개를 토끼 기준으로 벌리는 배율(1=기존). iPad Air 에서 토끼와 저금통/화분 간격을 넓히려 상향. */
const PLANT_FEET_GAP_SPREAD_MULTIPLIER = 1.45
/** 아주 좁은 화면(<640px)에서 발 옆 간격 배율 — 낮출수록 토끼 양옆으로 더 붙습니다. 640px 이상은 데스크톱 배율을 씁니다(예: 760px 창에서 저금통·화분이 넓게). */
/** SE(375)·S8+(360) 등 좁은 폰: 저금통·화분을 토끼 쪽으로 더 붙여 화면 가장자리(장바구니 아이콘 등) 겹침을 줄입니다. (1.0=기준앵커, 낮출수록 토끼에 더 붙음) */
const PLANT_FEET_GAP_SPREAD_MULTIPLIER_MOBILE = 0.6
/** 초소형 모바일(<=300px)에서 화분·물조리개 간격 배율 */
const PLANT_FEET_GAP_SPREAD_MULTIPLIER_TINY_MOBILE = 1.02

/**
 * 토끼(러그 중심 `rugCenterX`)와 발 옆 오브젝트(저금통·화분) 사이 **가로 거리(px)** 를 기준 너비에서의 값으로 고정합니다.
 *
 * 비개발자 설명:
 * - 화분·물조리개만 컨테이너 가로의 몇 %에 두면, 화면이 좁아질수록 같은 %라도 실제 픽셀 간격은 줄어듭니다.
 * - 그래서 “기준 너비(885px)에서 토끼 중심과 얼마나 떨어져 있었는지(px)”를 구해 두고,
 *   현재 너비에서도 그 픽셀 거리가 되도록 % 좌표를 다시 계산합니다. → 좁아져도 토끼와의 간격이 줄지 않습니다.
 * - `spreadMultiplier` 를 1에 가깝게 낮추면(아주 좁은 폭), 저금통과 화분이 서로 더 붙어 보입니다.
 */
function plantFeetAnchorsKeepRugGapPx(
  containerWidthPx: number,
  rugCenterX: number,
  plantPotBesideLeftFootX: number,
  wateringCanBesideRightFootX: number,
  referenceWidthPx: number,
): { plantPct: number; canPct: number } {
  if (!(containerWidthPx > 0) || !(referenceWidthPx > 0)) {
    return {
      plantPct: plantPotBesideLeftFootX * 100,
      canPct: wateringCanBesideRightFootX * 100,
    }
  }
  const spreadMultiplier =
    containerWidthPx <= 300
      ? PLANT_FEET_GAP_SPREAD_MULTIPLIER_TINY_MOBILE
      : containerWidthPx < 640
      ? PLANT_FEET_GAP_SPREAD_MULTIPLIER_MOBILE
      : PLANT_FEET_GAP_SPREAD_MULTIPLIER
  /** 기준 너비에서 토끼 중심 ↔ 화분·물조리개 **중심**까지 가로 거리(px) — 이 값을 모든 너비에서 유지 */
  const gapPlantCenterPx =
    (rugCenterX - plantPotBesideLeftFootX) * referenceWidthPx * spreadMultiplier
  const gapCanCenterPx =
    (wateringCanBesideRightFootX - rugCenterX) * referenceWidthPx * spreadMultiplier
  /**
   * 좁은 화면(<640px, SE·S8+·XR 등 폰)에서는 배율 계산을 쓰지 않고 **고정 위치**로 배치합니다.
   * - 기기·측정폭이 달라도 항상 동일하게 배치되어 겹침(오른쪽 장바구니 아이콘)·과밀을 막습니다.
   * - 저금통 왼쪽 24%, 화분 오른쪽 76% (토끼 중심 50% 양옆). 더 벌리려면 22/78, 더 붙이려면 28/72.
   *   (화분 76%↑ 는 오른쪽 장바구니 아이콘과 겹칠 수 있으니 주의)
   */
  if (containerWidthPx < 640) {
    return { plantPct: 24, canPct: 76 }
  }
  /** 중심에서 위 거리만큼 떨어진 픽셀 위치 → 현재 너비로 나눈 비율(0~1) */
  let plant = rugCenterX - gapPlantCenterPx / containerWidthPx
  let can = rugCenterX + gapCanCenterPx / containerWidthPx
  /** 매우 좁은 기기에서만 화면 밖으로 나가지 않게 자름(이때는 간격이 기준보다 좁아질 수 있음) */
  plant = Math.max(0.06, Math.min(0.49, plant))
  can = Math.min(0.94, Math.max(0.51, can))
  return { plantPct: plant * 100, canPct: can * 100 }
}

function scaleForPlantFeetUi(containerWidthPx: number): number {
  return scaleFromContainerWidth(
    containerWidthPx,
    LEVEL_BLOCK_SCALE_BASE_W,
    LEVEL_BLOCK_SCALE_FULL_W,
    PLANT_FEET_UI_SCALE_MAX,
  )
}

function scaleForCharacterUi(containerWidthPx: number): number {
  return scaleFromContainerWidth(
    containerWidthPx,
    LEVEL_BLOCK_SCALE_BASE_W,
    LEVEL_BLOCK_SCALE_FULL_W,
    CHARACTER_UI_SCALE_MAX,
  )
}

/**
 * 병아리 전용 배율 — 좁은 화면에서는 2/3배, 넓은 화면으로 갈수록 최대 1배까지 선형 보간합니다.
 * 비개발자: 병아리는 작은 화면에서 지금보다 더 작게, 큰 화면에서도 과하게 크지 않게 제한합니다.
 */
function scaleForChickUi(containerWidthPx: number): number {
  if (!(containerWidthPx > 0)) return CHICK_CHARACTER_UI_SCALE_MIN
  const span = LEVEL_BLOCK_SCALE_FULL_W - LEVEL_BLOCK_SCALE_BASE_W
  if (span <= 0) return CHICK_CHARACTER_UI_SCALE_MIN
  if (containerWidthPx <= LEVEL_BLOCK_SCALE_BASE_W) return CHICK_CHARACTER_UI_SCALE_MIN
  if (containerWidthPx >= LEVEL_BLOCK_SCALE_FULL_W) return CHICK_CHARACTER_UI_SCALE_MAX
  const t = (containerWidthPx - LEVEL_BLOCK_SCALE_BASE_W) / span
  return CHICK_CHARACTER_UI_SCALE_MIN + t * (CHICK_CHARACTER_UI_SCALE_MAX - CHICK_CHARACTER_UI_SCALE_MIN)
}

/**
 * 햄스터 전용 배율 — 좁은 화면에서는 2/3배, 넓은 화면으로 갈수록 최대 1.1배까지 선형 보간합니다.
 * 비개발자: 햄스터는 작은 화면에서 더 작게, 큰 화면에서도 과하게 커지지 않게 제한합니다.
 */
function scaleForHamsterUi(containerWidthPx: number): number {
  if (!(containerWidthPx > 0)) return HAMSTER_CHARACTER_UI_SCALE_MIN
  const span = LEVEL_BLOCK_SCALE_FULL_W - LEVEL_BLOCK_SCALE_BASE_W
  if (span <= 0) return HAMSTER_CHARACTER_UI_SCALE_MIN
  if (containerWidthPx <= LEVEL_BLOCK_SCALE_BASE_W) return HAMSTER_CHARACTER_UI_SCALE_MIN
  if (containerWidthPx >= LEVEL_BLOCK_SCALE_FULL_W) return HAMSTER_CHARACTER_UI_SCALE_MAX
  const t = (containerWidthPx - LEVEL_BLOCK_SCALE_BASE_W) / span
  return HAMSTER_CHARACTER_UI_SCALE_MIN + t * (HAMSTER_CHARACTER_UI_SCALE_MAX - HAMSTER_CHARACTER_UI_SCALE_MIN)
}

/**
 * 화면(컨테이너) 가로 너비에 따라 1배~max 배율을 선형 보간합니다.
 * 비개발자: 좁은 폰은 1배, 넓은 화면일수록 max 에 가깝게 커집니다.
 */
function scaleFromContainerWidth(
  containerWidthPx: number,
  baseW: number,
  fullW: number,
  maxScale: number,
): number {
  if (!(containerWidthPx > 0)) return 1
  const span = fullW - baseW
  if (span <= 0) return 1
  if (containerWidthPx <= baseW) return 1
  if (containerWidthPx >= fullW) return maxScale
  const t = (containerWidthPx - baseW) / span
  return 1 + t * (maxScale - 1)
}

function scaleForLevelBlock(containerWidthPx: number): number {
  return scaleFromContainerWidth(
    containerWidthPx,
    LEVEL_BLOCK_SCALE_BASE_W,
    LEVEL_BLOCK_SCALE_FULL_W,
    LEVEL_BLOCK_SCALE_MAX,
  )
}

/** 나가기·스티커·장바구니 묶음 — 좁은 화면도 살짝 키우고, 넓은 화면에서 `RIGHT_ICON_PRIMARY_SCALE_MAX` 까지 */
function scaleForRightIconPrimary(containerWidthPx: number): number {
  /**
   * 비개발자: 폰처럼 가로가 좁을 때도 아이콘이 너무 작지 않게(약 1.28배) 시작하고,
   * 태블릿·가로가 넓어질수록 더 커지다가 상한(약 2배)에서 멈춥니다.
   */
  const base = 1.28
  if (!(containerWidthPx > 0)) return base
  const span = RIGHT_ICON_PRIMARY_SCALE_FULL_W - RIGHT_ICON_PRIMARY_SCALE_BASE_W
  if (span <= 0) return base
  if (containerWidthPx <= RIGHT_ICON_PRIMARY_SCALE_BASE_W) return base
  if (containerWidthPx >= RIGHT_ICON_PRIMARY_SCALE_FULL_W) return RIGHT_ICON_PRIMARY_SCALE_MAX
  const t = (containerWidthPx - RIGHT_ICON_PRIMARY_SCALE_BASE_W) / span
  return base + t * (RIGHT_ICON_PRIMARY_SCALE_MAX - base)
}

/**
 * 유리 톤 버튼 셸(기본 40×40) — 뽀모도로·음악 등에 사용합니다.
 * 비개발자: 레벨 카드와 같은 반투명·둥근 유리 느낌의 버튼 테두리 박스입니다.
 */
const CHILD_HOME_RIGHT_ICON_GLASS_CLASS = [
  CHILD_HOME_TOP_BAR_GLASS_CLASS,
  'flex h-10 w-10 shrink-0 items-center justify-center',
].join(' ')

/**
 * 우측 나가기·스티커·장바구니 전용 — 안 그림을 조금 더 크게 두기 위해 박스를 44×44로 키웁니다.
 * 비개발자: 왼쪽 타이머/음악 버튼 크기는 그대로 두고, 오른쪽 세 아이콘만 살짝 더 크게 보이게 합니다.
 */
const CHILD_HOME_EXIT_STICKER_CART_GLASS_CLASS = [
  CHILD_HOME_TOP_BAR_GLASS_CLASS,
  'flex h-11 w-11 shrink-0 items-center justify-center',
].join(' ')

// ─── 파티클 타입 정의 ────────────────────────────────────────────────────────

/**
 * 미션 완료 시 카드 위치 → 크레딧 배지로 날아가는 개별 파티클 데이터.
 *
 * 비개발자 설명: 각 파티클이 어디서 출발해서 어디로 가는지,
 *               어떤 종류(코인/하트/별)인지, 몇 ms 후에 출발할지를 담습니다.
 */
type Particle = {
  id: number
  startX: number  // 카드 중심 X (컨테이너 기준)
  startY: number  // 카드 중심 Y (컨테이너 기준)
  endX: number    // 크레딧 배지 중심 X (컨테이너 기준)
  endY: number    // 크레딧 배지 중심 Y (컨테이너 기준)
  midX: number    // 포물선 중간 지점 X (컨테이너 기준)
  midY: number    // 포물선 중간 지점 Y (컨테이너 기준)
  type: 'coin' | 'heart' | 'star'
  delay: number   // 애니메이션 시작 지연(ms) — 여러 파티클이 조금씩 시차를 두고 날아갑니다
  durationMs: number
  sizePx: number
}

type Props = {
  childId: string
  childName: string
  /** 만 나이(세). null 이면 레벨만으로 기능 해금을 판단합니다. */
  ageYears: number | null
  /** 프로필 아바타 URL (캐릭터 종류 결정에 사용) */
  childAvatarUrl: string | null
  /** child_stats 초기값 */
  initialStats: ChildStats | null
  /** 오늘의 daily_missions (missions JOIN 포함) */
  dailyMissions: DailyMissionWithTemplate[]
  /** 오늘 날짜 YYYY-MM-DD (서울 기준) */
  today: string

  /** 칭찬 스티커 grants */
  initialPraiseGrants: PraiseStickerGrant[]
  /** 칭찬 스티커 placements */
  initialPraisePlacements: PraiseStickerPlacement[]

  /** 마켓 상품 목록 */
  marketEligibleItems: StoreItem[]
  initialHiddenStoreItemIds: string[]
  marketRequests: PurchaseRequest[]
  initialWishlistEntries: { storeItemId: string; quantity: number }[]

  /** 꾸미기 아이템 해금 인덱스 목록 */
  initialUnlockedItemIndexes: number[]

  /** 부모 화면으로 이동하는 href */
  exitHref: string

  /** 콘텐츠존 채널 목록 */
  contentChannels: ContentChannel[]
  /** 콘텐츠존 카테고리(자기조절력·파닉스 등) — 카테고리별 탐색에 사용 */
  contentCategories: ContentCategory[]
  /** 보유 보물상자 티켓 수 (영상 시청·인형뽑기 미니게임 공용) */
  initialChestTicketQuantity: number
  /** 진행 중 시청 세션 (있으면 복구) */
  initialActiveContentSession: ContentSession | null
}

// ─── 파티클 서브 컴포넌트 ──────────────────────────────────────────────────

/**
 * 개별 파티클 컴포넌트 — particleFly 키프레임으로 목적지까지 날아갑니다.
 * CSS 변수 --tx / --ty 에 이동 거리를 주입해 키프레임이 활용합니다.
 *
 * 비개발자 설명: 코인/하트/별 중 하나를 화면에 띄워
 *               카드에서 크레딧 배지 쪽으로 날아가게 만드는 컴포넌트입니다.
 */
const MissionParticle = memo(function MissionParticle({ particle: p }: { particle: Particle }) {
  const isIconSprite = p.type === 'coin' || p.type === 'heart'
  const animationName = p.type === 'heart' ? 'heartFloatFly' : 'particleFly'
  return (
    <div
      style={{
        position: 'absolute',
        left: p.startX,
        top: p.startY,
        fontSize: p.sizePx,
        lineHeight: 1,
        '--tx': `${p.endX - p.startX}px`,
        '--ty': `${p.endY - p.startY}px`,
        '--mx': `${p.midX - p.startX}px`,
        '--my': `${p.midY - p.startY}px`,
        animation: `${animationName} ${p.durationMs}ms cubic-bezier(0.2,0.7,0.2,1) ${p.delay}ms forwards`,
      } as React.CSSProperties}
    >
      {isIconSprite ? (
        <SpriteImage
          sheet={ICONS}
          frame={p.type === 'coin' ? 'credit' : 'heart'}
          width={p.sizePx}
          clipRotated={false}
          className="select-none"
        />
      ) : (
        '⭐'
      )}
    </div>
  )
})

/**
 * 크레딧 배지 주변 별 방사 이펙트.
 * badgeShine 상태가 true 일 때만 마운트됩니다.
 *
 * 비개발자 설명: 6개의 작은 점이 배지 주위에서 여섯 방향으로 퍼져나갑니다.
 */
function BadgeStarBurst({ badgeRef }: { badgeRef: React.RefObject<HTMLDivElement | null> }) {
  const rect = badgeRef.current?.getBoundingClientRect()
  if (!rect) return null
  /** 배지 중심 좌표 — fixed 기준이므로 직접 사용 가능 */
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  return (
    <div
      className="pointer-events-none fixed z-[70]"
      style={{ left: cx, top: cy }}
      aria-hidden
    >
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <div
          key={deg}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 8,
            height: 8,
            borderRadius: '50%',
            /** 짝수 인덱스: 황금색, 홀수: 흰색 */
            background: i % 2 === 0 ? '#FFD700' : '#FFFFFF',
            transformOrigin: 'center',
            transform: `translate(-50%,-50%) rotate(${deg}deg) translateY(-20px)`,
            animation: `starBurst 0.5s ease-out ${i * 50}ms forwards`,
          }}
        />
      ))}
    </div>
  )
}

// ─── 미션 정렬·중복 제거 (단일 ChildScreen 기준) ─────────────────────────

function dmToSortable(dm: DailyMissionWithTemplate): RoutineFlowSortable | null {
  if (!dm.missions) return null
  return {
    title: dm.missions.title,
    block: dm.missions.block ?? null,
    scheduled_time: dm.scheduled_time ?? null,
    sort_order: dm.missions.sort_order ?? 0,
  }
}

function orderedMissionsForSlider(list: DailyMissionWithTemplate[]): DailyMissionWithTemplate[] {
  const routineRows = list.filter((dm) => dm.missions && !isSpecialSectionMission(dm.missions))
  const specialRows = list.filter((dm) => dm.missions && isSpecialSectionMission(dm.missions))

  /** 오전·오후 일상 루틴 먼저, 스페셜 미션은 맨 뒤 */
  const sortedRoutine = dedupeDailyRoutineMissionsByCanonicalKey(
    [...routineRows].sort((a, b) => {
      const sa = dmToSortable(a)
      const sb = dmToSortable(b)
      if (!sa || !sb) return 0
      return compareRoutineFlowSortable(sa, sb)
    }),
  )
  const sortedSpecial = [...specialRows].sort((a, b) => {
    const oa = a.missions?.sort_order ?? 0
    const ob = b.missions?.sort_order ?? 0
    if (oa !== ob) return oa - ob
    const ta = a.scheduled_time
    const tb = b.scheduled_time
    if (!ta && !tb) return (a.missions?.title ?? '').localeCompare(b.missions?.title ?? '', 'ko')
    if (!ta) return 1
    if (!tb) return -1
    return ta.localeCompare(tb)
  })

  return [...sortedRoutine, ...sortedSpecial]
}

/**
 * 자녀 앱 단일 화면 메인 컴포넌트
 */
export default function ChildScreen({
  childId,
  childName,
  ageYears,
  childAvatarUrl,
  initialStats,
  dailyMissions,
  today,
  initialPraiseGrants,
  initialPraisePlacements,
  marketEligibleItems,
  initialHiddenStoreItemIds,
  marketRequests,
  initialWishlistEntries,
  initialUnlockedItemIndexes,
  exitHref,
  contentChannels,
  contentCategories,
  initialChestTicketQuantity,
  initialActiveContentSession,
}: Props) {
  /**
   * 효과음 공통 재생기:
   * - 파일이 없거나 브라우저 정책으로 실패해도 앱 흐름은 계속됩니다.
   */
  const playUiSound = useCallback((src: string, volume = 0.9) => {
    try {
      const audio = new Audio(src)
      audio.volume = volume
      void audio.play().catch(() => {
        /* noop */
      })
    } catch {
      /* noop */
    }
  }, [])

  /** 전체 화면을 감싸는 컨테이너 ref — 캐릭터 높이 + 파티클 좌표 기준 계산에 사용 */
  const containerRef = useRef<HTMLDivElement>(null)
  /** 레벨 카드 배율에 가로·캐릭터 높이에 세로 — 같은 전체 화면 컨테이너 실측값 사용 */
  const { width: containerW, height: containerH } = useContainerSize(containerRef)

  /** 크레딧 배지 ref — 동전 파티클이 날아가는 목적지(숫자·아이콘 줄) */
  const creditBadgeRef = useRef<HTMLDivElement>(null)
  /** 미션 섹션 ref — 콘텐츠 시간 종료 후 스크롤 이동 */
  const missionSectionRef = useRef<HTMLDivElement>(null)
  /** Mission Complete 하트 5칸 ref — **애정 하트(미션 보상)** 파티클 목적지 */
  const levelHeartsRef = useRef<HTMLDivElement>(null)
  /** 현재 화면에 떠 있는 파티클 목록 */
  const [particles, setParticles] = useState<Particle[]>([])

  /** 크레딧 배지 반짝임 활성화 여부 */
  const [badgeShine, setBadgeShine] = useState(false)

  const router = useRouter()
  const { childEnterActive, endChildEnter, beginParentExit } = useChildEnterTransition()

  /** 부모→자녀 진입 오버레이 — 자녀 홈 배경이 한 프레임 그려진 뒤 끕니다 */
  useEffect(() => {
    if (!childEnterActive) return
    let outer = 0
    let inner = 0
    outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        endChildEnter()
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [childEnterActive, endChildEnter])

  /**
   * 클라이언트 기준 "서울 오늘 날짜" 키.
   * 서버 props(`today`)가 자정 이후 늦게 갱신되는 틈을 메우기 위해 별도로 유지합니다.
   */
  const [seoulDayKey, setSeoulDayKey] = useState(() => today)

  /** 자녀 홈 본문 — SSR 직후 바로 보이게 (추가 rAF 대기 없음) */
  const [enterReveal, setEnterReveal] = useState(true)

  /** 나가기 — 전역 오버레이 + 클라이언트 라우팅(전체 새로고침 없음) */
  const [isExiting, setIsExiting] = useState(false)
  const handleExitClick = useCallback(async () => {
    if (isExiting) return
    const isParentPreviewExit = exitHref.includes('exit-child-ui')
    flushSync(() => {
      setIsExiting(true)
      beginParentExit()
    })
    try {
      if (isParentPreviewExit) {
        const res = await fetch(PARENT_EXIT_CHILD_UI_JSON_HREF, { credentials: 'include' })
        const { data, parseError } = await parseJsonFromResponse<{ ok?: boolean; redirectTo?: string }>(res)
        if (!res.ok || parseError || !data?.ok) throw new Error('exit-child-ui failed')
        router.push(data.redirectTo ?? '/parent/home')
      } else {
        router.push(exitHref)
      }
    } catch {
      setIsExiting(false)
      window.location.assign(exitHref)
    }
  }, [beginParentExit, exitHref, isExiting, router])

  // ── 통계(크레딧/하트) ──────────────────────────────────────────────────────

  const [stats, setStats] = useState<ChildStats | null>(() =>
    initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null,
  )

  /** 아직 받아 가지 않은 저금통 이자 — 저금통 위에 이 수만큼 반짝이는 코인이 뜹니다 */
  const [piggyBonusPending, setPiggyBonusPending] = useState<number>(() =>
    readChildStatInt(initialStats?.piggy_bonus_pending),
  )

  /**
   * 부모가 저장한 루틴 알람(기상·잘시간·하원 등) 번들을 DB(child_stats.routine_alarm_prefs)에서
   * localStorage 로 복원합니다. 자녀 알람 컴포넌트들이 localStorage 를 읽기 **전에** 렌더 중 1회 실행해,
   * 다른 기기에서 설정한 알람이 이 기기 자녀 앱에도 그대로 반영되게 합니다.
   */
  const alarmRestoredRef = useRef(false)
  if (!alarmRestoredRef.current && typeof window !== 'undefined') {
    alarmRestoredRef.current = true
    restoreRoutineAlarmStorage(initialStats?.routine_alarm_prefs ?? null)
  }

  /** 다이어리 배경 PNG — 홈 진입 시 미리 확인(없으면 팝업에서 404 대기 없음) */
  useEffect(() => {
    void probeDiaryBackgroundAvailable()
  }, [])

  /** DiaryModal 왼쪽 프로필 — 홈에서 이미 알고 있는 자녀 정보 */
  const diaryChildProfile = useMemo((): DiaryChildProfile => {
    const avatarUrl =
      childAvatarUrl && isAllowedChildProfileAvatarUrl(childAvatarUrl)
        ? childAvatarUrl
        : publicUrlForChildProfileAvatar('bunny_profile.png')
    return {
      name: childName.trim() || '친구',
      avatarUrl,
      ageYears,
      currentLevel: stats?.current_level ?? 0,
    }
  }, [childAvatarUrl, childName, ageYears, stats?.current_level])

  /**
   * 물주기 API 가 저장한 하트·화분 진행을 레벨 카드 `stats` 에도 바로 반영합니다.
   * 비개발자: 위쪽 숫자와 화분이 서로 다른 값으로 남는 것을 막습니다.
   */
  const onPlantStatsSynced = useCallback((patch: Record<string, unknown>) => {
    setStats((prev) => normalizeChildStatsCreditsSplit(mergeChildStatsPatch(prev, patch)))
  }, [])

  const onWaterPending = useCallback((pending: boolean) => {
    pendingStatsWritesRef.current = Math.max(0, pendingStatsWritesRef.current + (pending ? 1 : -1))
  }, [])

  /**
   * 저금통 이자 정산 — 앱을 열 때 한 번 서버에 요청합니다.
   *
   * 비개발자: 저금통에 10크레딧 이상을 3일 두면 이자가 붙습니다(저금액이 많을수록 이자율↑).
   * 이자는 바로 들어오지 않고 「받을 보너스」에 쌓이며, 저금통 위에 뜬 반짝이는 코인을
   * 아이가 1개씩 눌러야 크레딧이 됩니다. 지급 판단은 모두 서버가 합니다(중복 지급 방지).
   */
  useEffect(() => {
    if (!childId) return
    let cancelled = false
    void settlePiggyBonus(childId).then((res) => {
      if (cancelled || !res) return
      setPiggyBonusPending(res.pending)
    })
    return () => {
      cancelled = true
    }
  }, [childId])

  /** 인형뽑기 그랩 API가 저장한 하트·크레딧을 레벨 카드 `stats` 에도 바로 반영합니다. */
  const onClawStatsSynced = useCallback((patch: Record<string, unknown>) => {
    setStats((prev) => normalizeChildStatsCreditsSplit(mergeChildStatsPatch(prev, patch)))
  }, [])

  const onClawGrabPending = useCallback((pending: boolean) => {
    pendingStatsWritesRef.current = Math.max(0, pendingStatsWritesRef.current + (pending ? 1 : -1))
  }, [])

  /** 화분(식물) — `child_stats`의 pot_* 컬럼과 동기화 */
  const {
    pot,
    hearts: plantHearts,
    loading: plantLoading,
    water,
    stageLocked: plantStageLocked,
    unlockStageTransition,
    buySeed,
    bumpHeartsForMissionOptimistic,
    rollbackMissionHeartsOptimistic,
  } = usePlantPot(childId, { onPlantStatsSynced, onWaterPending })
  /** 완성 후 씨앗 고르기 모달 */
  const { refresh: refreshHarvestInventory } = usePlantHarvest(childId)
  /** 성장 단계 축하 팝업 — 도달한 단계 번호(null 이메 닫힘) */
  const [plantCelebrateStage, setPlantCelebrateStage] = useState<PlantStage | null>(null)
  const [plantHarvestCelebrate, setPlantHarvestCelebrate] = useState<PlantHarvestCelebrate | null>(null)
  /** 하트가 0일 때 물주기 시 잠깐 뜨는 안내 */
  const [plantHint, setPlantHint] = useState<string | null>(null)
  const handlePlantGrowthCelebrate = useCallback(
    (newStage: PlantStage, harvest?: PlantHarvestCelebrate) => {
      playUiSound(PLANT_STAGE_UP_SOUND_SRC, 0.9)
      setPlantCelebrateStage(newStage)
      if (newStage === 7) {
        setPlantHarvestCelebrate(harvest ?? null)
        if (harvest) void refreshHarvestInventory()
      } else {
        setPlantHarvestCelebrate(null)
      }
    },
    [playUiSound, refreshHarvestInventory],
  )

  const dismissPlantCelebrate = useCallback(() => {
    setPlantCelebrateStage(null)
    setPlantHarvestCelebrate(null)
    unlockStageTransition()
  }, [unlockStageTransition])

  /**
   * 레벨 카드·물조리개에 쓸 보유 하트.
   * - 미션 보상은 `stats` 와 화분 훅 둘 다 낙관적으로 올리므로, 둘 중 큰 값을 써서 한쪽만 늦게 와도 바로 보입니다.
   * - 물주기 후 API가 `onPlantStatsSynced` 로 stats 를 맞추고, 훅은 `refresh` 로 DB와 동기화합니다.
   * - Realtime 이 `hearts` 없이 `pot_*` 만 줄 때는 여전히 한쪽이 잠깐 늦을 수 있어, 가능한 한 max 로 맞춥니다.
   */
  const statsHeartsUi = readChildStatInt(stats?.hearts)
  const heartsForHomeUi =
    !plantLoading && pot != null ? Math.max(statsHeartsUi, plantHearts) : statsHeartsUi

  useEffect(() => {
    if (!plantHint) return
    const id = window.setTimeout(() => setPlantHint(null), 2200)
    return () => clearTimeout(id)
  }, [plantHint])

  useEffect(() => {
    const next = initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null
    setStats((prev) => {
      if (!next) return null
      if (!prev) return next
      /**
       * 미션 완료 직후 느린 `/home` 재조회가 아직 커밋 전 옛 값을 내려주면 방금 올린 크레딧이
       * 되돌아가 보입니다(롤백). 쓰기 진행 중이거나 최근 갱신 직후에는 서버 프롭으로 덮어쓰지 않습니다.
       */
      if (pendingStatsWritesRef.current > 0) return prev
      if (
        typeof performance !== 'undefined' &&
        performance.now() - lastLocalStatsBumpAtRef.current < STALE_STATS_GUARD_MS
      ) {
        return prev
      }
      /**
       * 위 6초 가드를 지난 뒤에는 **항상 서버 값이 정답**입니다.
       * (한때 `total_credits_earned` 이 더 낮은 스냅샷을 무시하도록 막아 뒀는데, 낙관적 업데이트가
       *  이 누적치도 같이 올리기 때문에 서버 저장이 한 번이라도 어긋나면 화면이 영구히 높은 값에
       *  갇혀 버렸습니다. 그 상태로 마켓에 가면 잔액은 넉넉해 보이는데 결제만 "코인 부족"으로
       *  거절돼 원인을 알 수 없게 됩니다. 그래서 무조건 서버 값으로 되돌아오게 둡니다.)
       *
       * 단, **서버 스냅샷끼리는 저장 시각(updated_at) 순서를 지킵니다.** 이미 더 최신 서버 값을
       * 반영한 뒤라면 뒤늦게 도착한 옛 스냅샷은 무시합니다(아래 Realtime 도 동일).
       */
      if (isStaleServerStats(next)) return prev
      rememberServerStatsAt(next)
      return next
    })
  }, [initialStats])

  /** 총 크레딧 (지갑+저금통+돈바구니 합산) */
  const totalCredits = stats?.credits ?? 0

  /**
   * 부모가 저장한 「잘 준비」 알림 시각 (HH:MM) — child_stats.sleep_ready_time
   * 비개발자 설명: 이 시간이 되면 잠자리 준비 알림 팝업이 한 번 떠요.
   */
  const sleepReadyTimeHHMM = useMemo(() => {
    const t = initialStats?.sleep_ready_time?.trim()
    if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null
    const [h, m] = t.split(':')
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  }, [initialStats?.sleep_ready_time])

  /** 등원 알람 시각 — child_stats.school_time */
  const schoolTimeHHMM = useMemo(() => {
    const t = initialStats?.school_time?.trim()
    if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null
    const [h, m] = t.split(':')
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  }, [initialStats?.school_time])

  /** DB 플래그 — 주중·주말·전체 사용 (서버 기본값과 맞춤) */
  const schoolTimeEnabled = initialStats?.school_time_enabled ?? false
  const schoolTimeWeekday = initialStats?.school_time_weekday ?? true
  const schoolTimeWeekend = initialStats?.school_time_weekend ?? true
  const sleepReadyTimeEnabled = initialStats?.sleep_ready_time_enabled ?? true
  const sleepReadyTimeWeekday = initialStats?.sleep_ready_time_weekday ?? true
  const sleepReadyTimeWeekend = initialStats?.sleep_ready_time_weekend ?? true

  /**
   * 서울 시각 기준으로 「오전에 오후 미션」「잠 준비 전 취침 미션」 탭을 막습니다.
   * 서버 `/api/daily-mission/complete` 와 같은 규칙입니다.
   * 스페셜 미션(event·daily+special)은 「정오 전 오후 미션」 가드만 면제 — DB에 afternoon 블록이 있어도 오전에 완료 가능.
   * 취침(bedtime) 블록 + 잠 준비 시각 가드는 스페셜도 동일하게 적용합니다.
   */
  const getHonestyBlockForMission = useCallback(
    (dm: DailyMissionWithTemplate): MissionHonestyBlockReason | null => {
      if (!dm.missions) return null
      const nowStr = getSeoulTimeHHMM()
      /** 취침(bedtime) 블록은 잠 준비 시각 가드를 먼저 적용(오전에 「오후 미션」만 뜨지 않게 함) */
      if (
        isBedtimeMissionBlockedBeforeSleepReadyWindow(dm.missions.block, {
          sleepReadyHHMM: sleepReadyTimeHHMM,
          sleepReadyEnabled: sleepReadyTimeEnabled,
          sleepReadyWeekday: sleepReadyTimeWeekday,
          sleepReadyWeekend: sleepReadyTimeWeekend,
          seoulDateYmd: seoulDayKey,
          seoulNowHHMM: nowStr,
        })
      ) {
        return 'bedtime_before_sleep_ready'
      }
      if (
        !isSpecialSectionMission(dm.missions) &&
        isAfternoonMission(dm) &&
        isSeoulTimeBeforeNoon(nowStr)
      ) {
        return 'afternoon_before_noon'
      }
      return null
    },
    [
      seoulDayKey,
      sleepReadyTimeHHMM,
      sleepReadyTimeEnabled,
      sleepReadyTimeWeekday,
      sleepReadyTimeWeekend,
    ],
  )

  // ── 미션 완료 상태 ─────────────────────────────────────────────────────────

  const [done, setDone] = useState<Set<string>>(
    () => new Set(dailyMissions.filter((dm) => dm.is_completed).map((dm) => dm.id)),
  )
  const [missionList, setMissionList] = useState<DailyMissionWithTemplate[]>(dailyMissions)
  const [missionSyncing, setMissionSyncing] = useState(false)
  const [missionSyncError, setMissionSyncError] = useState<string | null>(null)
  /**
   * 「미션이 없다」고 단정하기 전 잠깐 기다립니다.
   *
   * 왜: 화면이 뜨자마자 카드가 아직 안 왔을 뿐인데 「아직 미션이 없어요」가 보여서,
   * 아이·부모가 카드가 다 사라진 줄 알고 당황했습니다.
   * 이 시간 안에 카드가 오면 안내는 뜨지 않고, 지나도 없으면 그때 비었다고 알립니다.
   */
  const [missionEmptyConfirmed, setMissionEmptyConfirmed] = useState(false)
  const missionAutoSyncAttemptedRef = useRef(false)

  /** 전체 홈을 다시 읽지 않고 오늘의 미션만 생성·조회해 즉시 화면에 반영합니다. */
  const handleChildHomeRefresh = useCallback(async () => {
    if (missionSyncing) return
    setMissionSyncing(true)
    setMissionSyncError(null)
    try {
      const res = await fetch('/api/mission/child-today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId }),
        credentials: 'include',
        cache: 'no-store',
      })
      const { data, parseError } = await parseJsonFromResponse<{
        ok?: boolean
        date?: string
        missions?: DailyMissionWithTemplate[]
        error?: string
      }>(res)
      if (!res.ok || parseError || !data?.ok || !Array.isArray(data.missions)) {
        throw new Error(data?.error || '오늘의 미션을 불러오지 못했어요')
      }
      setMissionList(data.missions)
      setDone(new Set(data.missions.filter((dm) => dm.is_completed).map((dm) => dm.id)))
      if (data.date) setSeoulDayKey(data.date)
    } catch (error) {
      console.error('[child/home] today mission sync', error)
      setMissionSyncError(error instanceof Error ? error.message : '오늘의 미션을 불러오지 못했어요')
    } finally {
      setMissionSyncing(false)
    }
  }, [childId, missionSyncing])

  /** 첫 화면에 카드가 비었으면 아이가 버튼을 누르기 전에 한 번 자동 복구합니다. */
  useEffect(() => {
    if (missionList.length > 0 || missionAutoSyncAttemptedRef.current) return
    missionAutoSyncAttemptedRef.current = true
    void handleChildHomeRefresh()
  }, [handleChildHomeRefresh, missionList.length])

  // ── 연속 탭 감지 ───────────────────────────────────────────────────────────

  /**
   * 최근 완료 처리된 타임스탬프(ms)를 기록합니다.
   * - 3초(3000ms) 이내에 5개 이상이 쌓이면 확인 팝업을 띄웁니다.
   * - ref를 사용해 리렌더링 없이 빠르게 갱신합니다.
   */
  const recentTapTimestamps = useRef<number[]>([])

  /**
   * 3초 이내 연속 탭으로 "완료 처리"에 실제로 들어간 daily_mission id(최대 4개).
   * 5번째 탭이 팝업을 뜨기 직전까지 쌓인 것으로, 「미안.. 다시 할게」시 서버/화면에 함께 롤백합니다.
   */
  const rapidBurstCommittedIdsRef = useRef<string[]>([])

  /**
   * 팝업이 열려있는 동안 처리를 보류한 미션 정보.
   * 확인/취소 후 이 정보를 기반으로 완료 또는 취소를 결정합니다.
   */
  const pendingMissionRef = useRef<{
    dm: DailyMissionWithTemplate
    cardRect: DOMRect
    creditReward: number
    heartReward: number
  } | null>(null)

  /** 연속 탭 확인 팝업 표시 여부 */
  const [rapidTapModalOpen, setRapidTapModalOpen] = useState(false)

  /** 시각 제한(오전·잠 준비 전)으로 탭이 막혔을 때 — 소리 없는 수달 안내 */
  const [honestyModalOpen, setHonestyModalOpen] = useState(false)
  const [honestyBlockReason, setHonestyBlockReason] = useState<MissionHonestyBlockReason | null>(null)

  /**
   * 연속 탭 취소 시 5번째(팝업 직전) 카드에만 `ChildMissionCard`의 탭 잠금(fired)을 풀기 위한 키.
   * 비개발자: "미안" 누른 뒤에도 그 카드가 다시 눌리게 숫자를 올려 카드를 살짝 "새로 알려줍니다."
   */
  const [missionTapUnblock, setMissionTapUnblock] = useState<Record<string, number>>({})

  /**
   * 부모가 완료 미션을 「다시하기」로 롤백했을 때만 뜨는 안내(소리 없음).
   * 비개발자 설명: 엄마·아빠 화면에서 되돌리기를 누르면, 아이 태블릿에도 같은 내용이 실시간으로 반영되면서 이 창이 잠깐 떠요.
   */
  const [parentRedoModalMission, setParentRedoModalMission] = useState<DailyMissionWithTemplate | null>(null)

  /** daily_missions·mission_logs·Strict Mode 이중 호출이 겹쳐도 팝업·done·코인 조정이 한 번만 실행되게 합니다 */
  const parentRedoNoticeDedupeRef = useRef<string | null>(null)
  const rollbackUiCooldownRef = useRef<Map<string, number>>(new Map())
  /**
   * 완료 API가 성공했는데 부모 RSC/캐시가 잠깐 늦으면 `dailyMissions` 가 다시 비완료처럼 내려와
   * `done`(완료 목록) 이 통째로 초기화되어 카드가 다시 보이는 현상을 막습니다.
   * 부모가 진짜로 「다시하기」하거나 Realtime 이 비완료로 오면 이 집합에서 해당 id 를 빼고 롤백 UI 를 허용합니다.
   */
  const optimisticDailyMissionCompleteIdsRef = useRef<Set<string>>(new Set())

  /**
   * 미션 완료·저금통 이체 등 credits/hearts 낙관적 업데이트가 진행 중인 요청 수.
   * 0보다 크면 statsChannel Realtime UPDATE가 credits/credits_piggy/hearts/total_credits_earned를
   * 덮어쓰지 않도록 막아, 낙관적 업데이트와 서버 이벤트가 경합해 숫자가 출렁이는 것을 막습니다.
   */
  const pendingStatsWritesRef = useRef(0)
  /** 미션 완료로 stats 를 올린 마지막 시각(performance.now, 단조 시계). 직후엔 스테일 서버 프롭으로 덮어쓰지 않음. */
  const lastLocalStatsBumpAtRef = useRef(0)
  /**
   * 미션 완료 API 요청을 순서대로만 보내는 큐(Promise 체인).
   * 카드 연타로 여러 건이 거의 동시에 커밋되면 이전에는 각자 독립적으로 fetch 를 쐈는데,
   * 서버가 크레딧을 "읽은 값 + 보상"으로 저장하는 예전(RPC 미적용) 경로에서는 동시 요청이
   * 같은 잔액을 읽고 서로 덮어써 보상이 유실됐습니다(Lost Update). 요청을 직렬화해 두면
   * 서버 쪽 원자화 여부와 무관하게 이 경합 자체가 발생하지 않습니다.
   */
  const missionCompleteRequestQueueRef = useRef<Promise<void>>(Promise.resolve())

  /**
   * 마지막으로 화면에 반영한 **서버 스냅샷의 저장 시각**(child_stats.updated_at, ms).
   *
   * 비개발자 설명:
   *   저금통에서 코인을 여러 번 옮기면 서버가 그만큼 여러 번 저장하고, 그 알림(Realtime)이
   *   순서가 뒤바뀌어 도착할 수 있습니다. 예전에는 늦게 도착한 **옛 알림**이 최신 숫자를 덮어써서
   *   크레딧이 올라갔다 내려갔다 했습니다. 이제는 저장 시각을 비교해, 이미 반영한 것보다 오래된
   *   알림은 무시합니다. (서버 값끼리만 비교하므로 화면이 옛 값에 갇히지 않습니다.)
   */
  const lastServerStatsAtRef = useRef(0)

  /** child_stats 행에서 저장 시각(ms)을 읽습니다. 없으면 0. */
  function readServerStatsAt(row: unknown): number {
    const raw = (row as Record<string, unknown> | null)?.updated_at
    if (typeof raw !== 'string') return 0
    const ms = Date.parse(raw)
    return Number.isFinite(ms) ? ms : 0
  }

  /** 이미 반영한 서버 스냅샷보다 오래된(=뒤늦게 도착한) 값인지 */
  function isStaleServerStats(row: unknown): boolean {
    const at = readServerStatsAt(row)
    /** 시각을 알 수 없으면 순서 판단을 하지 않고 그대로 반영합니다 */
    if (at === 0) return false
    return at < lastServerStatsAtRef.current
  }

  function rememberServerStatsAt(row: unknown): void {
    const at = readServerStatsAt(row)
    if (at > lastServerStatsAtRef.current) lastServerStatsAtRef.current = at
  }

  /**
   * 뽀모도로·알람 팝업(ChildAlarmClockPopup) 열림 여부
   * 비개발자 설명: 상단 우측 타이머(유리 버튼)를 누르면 true 가 되고, 닫기로 false 가 됩니다.
   */
  const [clockPopupOpen, setClockPopupOpen] = useState(false)
  const [isDiaryOpen, setIsDiaryOpen] = useState(false)
  const [diaryInitialDate, setDiaryInitialDate] = useState(today)
  /** 상단 우측 음악 아이콘 전용 팝업 열림 여부 */
  const [musicPopupOpen, setMusicPopupOpen] = useState(false)

  /** 전체 미션 완주 축하 오버레이 표시 여부 */
  const [showCelebration, setShowCelebration] = useState(false)
  /**
   * 같은 날·세션에서 축하 스케줄을 한 번만 걸기 위한 ref (useState 대신 stale closure 방지)
   * 비개발자 설명: 마지막 미션을 탭해 완료 처리할 때만 true 로 바뀌며, 날짜가 바뀌면 다시 false 로 돌아갑니다.
   */
  const celebrationShownRef = useRef(false)
  /** 700ms 뒤 오버레이 표시 예약 — API 실패 롤백 시 clearTimeout */
  /** DOM 환경에서 setTimeout 은 `number` 핸들을 돌려줌(Node 의 Timeout 타입과 혼동 주의) */
  const celebrationShowTimerRef = useRef<number | null>(null)
  /** 미션 완주 후 수면 모드(잘자 화면) */
  const [isSleeping, setIsSleeping] = useState(false)
  /** 수면 모드 다음 아침 인사 화면 */
  const [showMorningWake, setShowMorningWake] = useState(false)
  /**
   * 루틴 기상 알람 시각 "HH:MM" — 부모가 알람을 끄면 null (자동 아침 인사 없음, 탭으로만 깸)
   * 비개발자 설명: 이 태블릿 브라우저에 저장된 루틴 알람 설정을 읽습니다.
   */
  const [routineWakeAlarmHHMM, setRoutineWakeAlarmHHMM] = useState<string | null>(null)

  /** 잘 준비 알림 팝업 — 하루 한 번(날짜 바뀌면 ref 리셋) */
  const [showSleepReady, setShowSleepReady] = useState(false)
  const sleepReadyShownRef = useRef(false)
  /** 등원 알림 팝업 — 하루 한 번 */
  const [showSchoolTime, setShowSchoolTime] = useState(false)
  const schoolTimeShownRef = useRef(false)
  /** 축하·수면·기상·다른 루틴 팝업이 떠 있으면 새 알림을 띄우지 않음 */
  const blockRoutineAlarmPopupsRef = useRef(false)

  /** 서버 props가 갱신되면 클라이언트 day key도 같은 값으로 맞춥니다. */
  useEffect(() => {
    setSeoulDayKey((prev) => (prev === today ? prev : today))
  }, [today])

  /**
   * 서울 자정 타이머 + 포그라운드 복귀 시 날짜 점검.
   * 비개발자: 앱을 켜 둔 채로 자정이 지나도 "오늘 날짜"를 자동으로 넘깁니다.
   */
  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const bumpIfDateChanged = () => {
      const latest = getSeoulDateString()
      setSeoulDayKey((prev) => (prev === latest ? prev : latest))
    }

    const armNextMidnight = () => {
      const ms = getMsUntilNextSeoulMidnight()
      timeoutId = setTimeout(() => {
        if (cancelled) return
        bumpIfDateChanged()
        armNextMidnight()
      }, ms)
    }

    armNextMidnight()

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      bumpIfDateChanged()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', bumpIfDateChanged)

    return () => {
      cancelled = true
      if (timeoutId != null) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', bumpIfDateChanged)
    }
  }, [])

  /**
   * 서울 날짜 키가 서버 props와 달라지면 다음날 데이터를 즉시 재요청합니다.
   * 비개발자: "앱 재접속" 없이도 자정 이후 카드가 자동으로 바뀝니다.
   */
  useEffect(() => {
    if (seoulDayKey === today) return
    router.refresh()
  }, [router, seoulDayKey, today])

  /** 클라이언트에서만 루틴 기상 시각 로드 */
  useEffect(() => {
    const p = readRoutineAlarmPrefs()
    const t = p.wakeTime?.trim()
    if (p.notifyWake && t && /^\d{1,2}:\d{2}$/.test(t)) {
      const [hh, mm] = t.split(':')
      setRoutineWakeAlarmHHMM(`${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`)
    } else {
      setRoutineWakeAlarmHHMM(null)
    }
  }, [])

  /** 브라우저 자동 재생 규격을 완화 — 아이가 화면을 한 번이라도 건드리면 알람 WAV 재생 허용에 유리합니다 */
  useEffect(() => {
    installChildRoutineAudioUnlockOnFirstGesture()
  }, [])

  useEffect(() => {
    /** 서버 배열로 목록을 맞추되, 방금 완료 요청을 보낸 행(`optimisticDailyMissionCompleteIdsRef`)은 서버가 아직 `is_completed=false` 인 한 `done` 에 남깁니다. */
    setMissionList(dailyMissions)
    setDone(() => {
      const serverDone = new Set(dailyMissions.filter((dm) => dm.is_completed).map((dm) => dm.id))
      const merged = new Set(serverDone)
      const pend = optimisticDailyMissionCompleteIdsRef.current
      for (const id of [...pend]) {
        const row = dailyMissions.find((dm) => dm.id === id)
        if (!row) {
          pend.delete(id)
          continue
        }
        if (row.is_completed) {
          pend.delete(id)
          continue
        }
        merged.add(id)
      }
      return merged
    })
  }, [dailyMissions, seoulDayKey])

  /** 날짜(오늘)이 바뀌면 축하 관련 상태를 초기화합니다. */
  useEffect(() => {
    celebrationShownRef.current = false
    if (celebrationShowTimerRef.current != null) {
      clearTimeout(celebrationShowTimerRef.current)
      celebrationShowTimerRef.current = null
    }
    setShowCelebration(false)
    setIsSleeping(false)
    setShowMorningWake(false)
    sleepReadyShownRef.current = false
    setShowSleepReady(false)
    schoolTimeShownRef.current = false
    setShowSchoolTime(false)
    setParentRedoModalMission(null)
    optimisticDailyMissionCompleteIdsRef.current.clear()
  }, [seoulDayKey])

  /**
   * 부모 롤백·기타 갱신을 자녀 화면에 즉시 반영합니다.
   * - daily_missions: 오늘 카드가 미완료로 바뀌면 슬라이더에 다시 보입니다.
   * - mission_logs: 테이블은 예전부터 Realtime 에 포함되어 있어, daily_missions 이벤트가 안 오는 환경에서도 롤백을 감지합니다.
   * - child_stats: 크레딧·하트·경험치 등이 서버와 같이 움직입니다(롤백 시 차감 포함).
   */
  useEffect(() => {
    const supabase = createClient()

    function pushParentRedoNotice(dmRow: DailyMissionWithTemplate) {
      const key = dmRow.id
      if (parentRedoNoticeDedupeRef.current === key) return
      parentRedoNoticeDedupeRef.current = key
      window.setTimeout(() => {
        if (parentRedoNoticeDedupeRef.current === key) parentRedoNoticeDedupeRef.current = null
      }, 2500)
      setParentRedoModalMission(dmRow)
    }

    function consumeRollbackUiCooldown(dmId: string): boolean {
      const now = Date.now()
      const prev = rollbackUiCooldownRef.current.get(dmId) ?? 0
      if (now - prev < 1600) return false
      rollbackUiCooldownRef.current.set(dmId, now)
      return true
    }

    function finishRollbackUi(dmId: string, snapshot: DailyMissionWithTemplate) {
      setDone((prevDone) => {
        const wasDone = prevDone.has(dmId)
        const wasCompletedOnRow = snapshot.is_completed
        if (!wasDone && !wasCompletedOnRow) return prevDone
        if (!consumeRollbackUiCooldown(dmId)) return prevDone

        pushParentRedoNotice(snapshot)
        setShowCelebration(false)
        celebrationShownRef.current = false
        if (celebrationShowTimerRef.current != null) {
          clearTimeout(celebrationShowTimerRef.current)
          celebrationShowTimerRef.current = null
        }
        const next = new Set(prevDone)
        next.delete(dmId)
        return next
      })
    }

    /** DB Realtime·부모 Broadcast 모두 이 경로로 합칩니다 */
    function applyRollbackByDailyMissionId(dmId: string) {
      if (!dmId) return
      optimisticDailyMissionCompleteIdsRef.current.delete(dmId)
      setMissionList((prevList) => {
        const snapshot = prevList.find((m) => m.id === dmId)
        if (!snapshot) return prevList
        queueMicrotask(() => finishRollbackUi(dmId, snapshot))
        return prevList.map((m) =>
          m.id === dmId ? { ...m, is_completed: false, completed_at: null } : m,
        )
      })
    }

    function onDailyMissionRemoteUpdate(payload: { new: Record<string, unknown> }) {
      const row = payload.new
      const rowDate = toYyyyMmDdDbValue(row.date)
      if (rowDate !== seoulDayKey) return
      if (!dbValueMeansIncomplete(row.is_completed)) return
      const dmId = String(row.id ?? '')
      if (!dmId) return
      applyRollbackByDailyMissionId(dmId)
    }

    function onMissionLogRemoteUpdate(payload: { new: Record<string, unknown> }) {
      const row = payload.new
      const ad = toYyyyMmDdDbValue(row.assigned_date)
      if (ad !== seoulDayKey) return
      if (!dbValueMeansIncomplete(row.is_completed)) return
      const templateId = String(row.mission_id ?? '')
      if (!templateId) return

      setMissionList((prevList) => {
        const snapshot = prevList.find(
          (m) => m.mission_template_id === templateId && toYyyyMmDdDbValue(m.date) === seoulDayKey,
        )
        if (!snapshot) return prevList
        const dmId = snapshot.id
        optimisticDailyMissionCompleteIdsRef.current.delete(dmId)
        queueMicrotask(() => finishRollbackUi(dmId, snapshot))
        return prevList.map((m) =>
          m.id === dmId ? { ...m, is_completed: false, completed_at: null } : m,
        )
      })
    }

    /** 부모 앱이 같은 이름의 채널로 보내는 즉시 알림( DB postgres_changes 보조 ) */
    function readBroadcastRollbackDailyMissionId(msg: unknown): string {
      if (msg != null && typeof msg === 'object') {
        const o = msg as Record<string, unknown>
        if (typeof o.dailyMissionId === 'string') return o.dailyMissionId
        const p = o.payload
        if (p != null && typeof p === 'object' && typeof (p as Record<string, unknown>).dailyMissionId === 'string') {
          return (p as { dailyMissionId: string }).dailyMissionId
        }
      }
      return ''
    }

    const rollbackBroadcastTopic = `child-parent-rollback-${childId}`
    const broadcastChannel = supabase
      .channel(rollbackBroadcastTopic)
      .on('broadcast', { event: 'mission_rollback' }, (msg: unknown) => {
        const dmId = readBroadcastRollbackDailyMissionId(msg)
        if (!dmId) return
        applyRollbackByDailyMissionId(dmId)
      })
      .subscribe()

    const routineSyncChannel = supabase
      .channel(`child-routine-sync-${childId}`)
      .on('broadcast', { event: 'routine_saved' }, () => {
        router.refresh()
      })
      .subscribe()

    const dmChannel = supabase
      .channel(`child-screen-dm-${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'daily_missions',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => onDailyMissionRemoteUpdate(payload as { new: Record<string, unknown> }),
      )
      .subscribe()

    const mlChannel = supabase
      .channel(`child-screen-ml-${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mission_logs',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => onMissionLogRemoteUpdate(payload as { new: Record<string, unknown> }),
      )
      .subscribe()

    const statsChannel = supabase
      .channel(`child-screen-stats-${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'child_stats',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          /**
           * 미션 완료 처리 중(pending>0) 또는 완료 직후 짧은 창 동안에는 돈 관련 필드를 무시합니다.
           * 이유: `mission_logs` 기록이 먼저 커밋되며 `trg_mission_logs_recalc_eq` 가 child_stats 를
           * (아직 크레딧 증가 전 = 옛 값으로) UPDATE → 이 Realtime 이벤트가 fetch 종료 뒤 늦게 도착하면
           * 방금 올린 크레딧이 잠깐 내려갔다(딥) 올라오는 현상이 생깁니다. 로컬 값(낙관적·서버응답)이 정답.
           */
          const withinLocalStatsGuard =
            pendingStatsWritesRef.current > 0 ||
            (typeof performance !== 'undefined' &&
              performance.now() - lastLocalStatsBumpAtRef.current < STALE_STATS_GUARD_MS)
          /**
           * 순서가 뒤바뀌어 도착한 **옛 저장 알림**도 돈 관련 필드에서 제외합니다.
           * (저금통에서 코인을 연달아 옮기면 저장이 여러 번 일어나고, 그 알림이 뒤늦게 도착해
           *  최신 잔액을 옛 값으로 되돌리며 숫자가 왔다갔다 했습니다.)
           */
          if (withinLocalStatsGuard || isStaleServerStats(row)) {
            const { credits, credits_piggy, hearts, total_credits_earned, ...rest } = row
            void credits
            void credits_piggy
            void hearts
            void total_credits_earned
            setStats((prev) =>
              normalizeChildStatsCreditsSplit(mergeChildStatsPatch(prev, rest)),
            )
            return
          }
          /** 가드 창 밖에서는 서버 값이 정답 — 화면이 옛 낙관값에 갇히지 않게 그대로 반영합니다. */
          rememberServerStatsAt(row)
          setStats((prev) =>
            normalizeChildStatsCreditsSplit(mergeChildStatsPatch(prev, row)),
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(broadcastChannel)
      void supabase.removeChannel(routineSyncChannel)
      void supabase.removeChannel(dmChannel)
      void supabase.removeChannel(mlChannel)
      void supabase.removeChannel(statsChannel)
    }
  }, [childId, router, seoulDayKey])

  /** 루틴 시각 알림은 ref 로 ‘하루 1회’만 — 축하·수면·아침 화면만 막음 */
  useEffect(() => {
    blockRoutineAlarmPopupsRef.current = !!(showCelebration || isSleeping || showMorningWake)
  }, [showCelebration, isSleeping, showMorningWake])

  /**
   * 잘 준비·등원 시각 도달 시 팝업 — 30초마다 현재 시각과 비교
   * 비개발자 설명: 배터리를 아끼려고 1초마다 돌리지 않고, 대략 반분 안에 맞춰 뜹니다.
   * 시각·요일은 **서울(한국)** 기준으로 부모가 설정한 시각과 맞춥니다(기기가 해외 시간대여도 같은 시에 울림).
   */
  useEffect(() => {
    if (!sleepReadyTimeHHMM && !schoolTimeHHMM) return
    const check = () => {
      if (blockRoutineAlarmPopupsRef.current) return
      const current = getSeoulTimeHHMM()
      const isWeekend = ['토', '일'].includes(getSeoulWeekdayShort(seoulDayKey))

      const allowSleepReady =
        sleepReadyTimeHHMM &&
        sleepReadyTimeEnabled &&
        (isWeekend ? sleepReadyTimeWeekend : sleepReadyTimeWeekday)
      if (allowSleepReady && current === sleepReadyTimeHHMM && !sleepReadyShownRef.current) {
        sleepReadyShownRef.current = true
        setShowSleepReady(true)
      } else {
        const allowSchool =
          schoolTimeHHMM &&
          schoolTimeEnabled &&
          (isWeekend ? schoolTimeWeekend : schoolTimeWeekday)
        if (allowSchool && current === schoolTimeHHMM && !schoolTimeShownRef.current) {
          schoolTimeShownRef.current = true
          setShowSchoolTime(true)
        }
      }
    }
    check()
    const id = window.setInterval(check, 30000)
    return () => clearInterval(id)
  }, [
    sleepReadyTimeHHMM,
    schoolTimeHHMM,
    sleepReadyTimeEnabled,
    sleepReadyTimeWeekday,
    sleepReadyTimeWeekend,
    schoolTimeEnabled,
    schoolTimeWeekday,
    schoolTimeWeekend,
    seoulDayKey,
  ])

  /**
   * 포그라운드 복귀 시 미션 데이터 자동 동기화
   * - 부모 앱에서 크레딧·하트 설정을 바꾼 뒤 자녀가 앱으로 돌아오면
   *   router.refresh()로 서버에서 최신 missions 값을 다시 불러옵니다.
   * - 30초 이상 숨김 상태였을 때만 갱신해 과도한 요청을 방지합니다.
   */
  useEffect(() => {
    let hiddenAt: number | null = null

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (document.visibilityState === 'visible') {
        const elapsed = hiddenAt != null ? Date.now() - hiddenAt : Infinity
        if (elapsed >= 30_000) {
          router.refresh()
        }
        hiddenAt = null
      }
    }

    function onFocus() {
      const elapsed = hiddenAt != null ? Date.now() - hiddenAt : Infinity
      if (elapsed >= 30_000) {
        router.refresh()
      }
      hiddenAt = null
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [router])

  /** 폐지된 미션 제외 */
  const visibleMissions = useMemo(
    () =>
      missionList.filter((dm) => {
        const m = dm.missions
        /** 미션 템플릿이 삭제된 오늘 행은 조인이 없어 슬라이더에 못 넣음 — 제외해야 빈 화면 원인 진단이 맞음 */
        if (!m) return false
        if (isSpecialSectionMission(m) && isOrphanSpecialMissionTemplate(m)) return false
        if (isRetiredRoutineMissionTitle(m.title)) return false
        return true
      }),
    [missionList],
  )

  /** 정렬된 미션 목록 */
  const ordered = useMemo(() => orderedMissionsForSlider(visibleMissions), [visibleMissions])

  /** 완료된 카드는 슬라이더에서 숨김 */
  const incompleteOrdered = useMemo(
    () => ordered.filter((dm) => !done.has(dm.id)),
    [ordered, done],
  )

  /** 완료율 → 하트 수 (0~5) */
  const filledHearts = useMemo(
    () => completionRateToHearts(
      visibleMissions.filter((dm) => done.has(dm.id)).length,
      visibleMissions.length,
    ),
    [visibleMissions, done],
  )

  /**
   * 배지 반짝임 트리거 — 파티클이 모두 도착한 뒤(650 ms) 호출됩니다.
   *
   * 비개발자 설명: 코인이 배지에 닿으면 황금빛 빛남 + 숫자가 잠깐 커집니다.
   */
  const triggerBadgeShine = useCallback(() => {
    setBadgeShine(true)
    setTimeout(() => setBadgeShine(false), 600)
  }, [])

  /** 카드가 하나라도 오면 확정을 풀고, 계속 비어 있으면 잠시 뒤 「없음」으로 확정합니다 */
  useEffect(() => {
    if (visibleMissions.length > 0) {
      setMissionEmptyConfirmed(false)
      return
    }
    const timer = window.setTimeout(() => setMissionEmptyConfirmed(true), MISSION_EMPTY_CONFIRM_MS)
    return () => window.clearTimeout(timer)
  }, [visibleMissions.length])

  /**
   * 미션 완료 핸들러.
   * - 기존 API 호출 로직(낙관적 완료 + 롤백)은 그대로 유지합니다.
   * - cardRect / creditReward / heartReward 를 추가로 받아 파티클을 생성합니다.
   *
   * 비개발자 설명: 카드를 탭하면 (1) 완료 처리 API를 호출하고,
   *               (2) 코인·하트 파티클을 배지 방향으로 날려 보냅니다.
   */
  /**
   * 실제 미션 완료 처리 — 파티클 생성 + API 호출.
   * 연속 탭 감지에서 확인을 받은 뒤에도 이 함수를 재사용합니다.
   */
  const commitMissionComplete = useCallback(
    (
      dm: DailyMissionWithTemplate,
      cardRect: DOMRect,
      creditReward: number,
      heartReward: number,
    ) => {
      /**
       * 미션 완료 API 가 끝나기 전에 `router.refresh()` 등으로 부모 페이지 데이터가 새로 들어오면,
       * 아래 `useEffect([dailyMissions])` 가 서버 값(아직 미완료)만 보고 `done` 을 덮어쓸 수 있습니다.
       * 그래서 **요청을 보내는 순간** 낙관적 id 를 ref 에 넣어, 완료 응답이 올 때까지 목록과 싱크가 깨지지 않게 합니다.
       * 비개발자: "서버가 잠깐 늦어도 화면에서 완료한 카드는 사라진 채로 유지"됩니다.
       */
      optimisticDailyMissionCompleteIdsRef.current.add(dm.id)
      /**
       * Supabase/서버 완료 응답을 기다리지 않고 보유 하트·크레딧을 먼저 올립니다(낙관적 UI).
       * 아래 fetch 가 실패하면 같은 보상만큼 빼서 되돌립니다.
       * 비개발자: "보상 숫자는 탭하자마자 올라가고, 저장이 안 되면 다시 내려가요."
       */
      setStats((prev) => (prev ? applyOptimisticMissionMoneyRewards(prev, creditReward, heartReward) : prev))
      if (typeof performance !== 'undefined') lastLocalStatsBumpAtRef.current = performance.now()
      /** 화분 훅 숫자도 같이 올려 `heartsForHomeUi` 가 plantHearts 만 볼 때 생기던 지연을 없앱니다 */
      bumpHeartsForMissionOptimistic(heartReward)
      /**
       * 카드가 사라지는 순간 그 위치에서 컨페티(새로 추가).
       * 비개발자: “완료” 글자 화면 대신 색종이가 터지는 느낌으로 축하합니다.
       */
      fireMissionCardConfetti(cardRect)

      /** 낙관적 완료 — DOM에서 카드를 제거하기 전에 파티클을 먼저 띄웁니다 */
      const containerRect = containerRef.current?.getBoundingClientRect()
      const badgeRect = creditBadgeRef.current?.getBoundingClientRect()
      const levelHeartsRow = levelHeartsRef.current?.getBoundingClientRect()

      if (containerRect && badgeRect) {
        const startX = cardRect.left + cardRect.width / 2 - containerRect.left
        const startY = cardRect.top + cardRect.height / 2 - containerRect.top
        const endCoinX = badgeRect.left + badgeRect.width / 2 - containerRect.left
        const endCoinY = badgeRect.top + badgeRect.height / 2 - containerRect.top
        /**
         * 애정 하트는 상단 레벨 블록의 **크레딧 아래 하트 줄** 중심으로 날아갑니다.
         * (없으면 예전과 같이 크레딧 배지로 떨어짐)
         */
        const endHeartX = levelHeartsRow
          ? levelHeartsRow.left + levelHeartsRow.width / 2 - containerRect.left
          : endCoinX
        const endHeartY = levelHeartsRow
          ? levelHeartsRow.top + levelHeartsRow.height / 2 - containerRect.top
          : endCoinY

        /**
         * 보상 개수만큼 파티클을 만듭니다.
         * - 시작점을 카드 중심 근처로 랜덤 분산해 "터져 나오는" 느낌을 냅니다.
         * - midY를 더 위로 잡아 포물선 비행처럼 보이게 합니다.
         */
        const base = Date.now() * 1000
        const newParticles: Particle[] = []
        let idSeq = 0
        const pushBurstParticles = (
          count: number,
          type: 'coin' | 'heart',
          targetX: number,
          targetY: number,
          baseDelayMs: number,
        ) => {
          for (let i = 0; i < Math.max(0, count); i += 1) {
            const burstX = (Math.random() - 0.5) * 48
            const burstY = -8 - Math.random() * 26
            const particleStartX = startX + burstX
            const particleStartY = startY + burstY
            const curveBias = (Math.random() - 0.5) * (type === 'heart' ? 30 : 18)
            const arcLift = type === 'heart' ? 90 + Math.random() * 58 : 54 + Math.random() * 44
            const midX = particleStartX + (targetX - particleStartX) * 0.45 + curveBias
            const midY =
              particleStartY +
              (targetY - particleStartY) * (type === 'heart' ? 0.32 : 0.38) -
              arcLift
            newParticles.push({
              id: base + idSeq,
              startX: particleStartX,
              startY: particleStartY,
              endX: targetX,
              endY: targetY,
              midX,
              midY,
              type,
              delay: baseDelayMs + i * 70,
              // 코인은 하트보다 살짝 느리게 이동해 개수가 더 또렷하게 보이도록 조정합니다.
              durationMs:
                type === 'coin'
                  ? 1120 + Math.round(Math.random() * 220)
                  : 1780 + Math.round(Math.random() * 320),
              sizePx: type === 'heart' ? 25 + Math.round(Math.random() * 4) : 20 + Math.round(Math.random() * 4),
            })
            idSeq += 1
          }
        }
        pushBurstParticles(creditReward, 'coin', endCoinX, endCoinY, 0)
        pushBurstParticles(heartReward, 'heart', endHeartX, endHeartY, 90)

        setParticles((prev) => [...prev, ...newParticles])

        const lastFlightEndMs =
          newParticles.reduce((max, p) => Math.max(max, p.delay + p.durationMs), 0) + 60
        setTimeout(() => {
          setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)))
          triggerBadgeShine()
        }, lastFlightEndMs)
      }

      /**
       * 완료한 미션을 슬라이더에서 빼고, 상단 「오늘 미션 하트 5칸」 채움 비율을 바로 반영합니다.
       * (예전에는 220ms 늦춰 두어 숫자·칸이 늦게 바뀌는 느낌이 났습니다.)
       */
      setDone((prev) => {
        const next = new Set([...prev, dm.id])
        const allNowDone = visibleMissions.every((m) => next.has(m.id))
        if (allNowDone && visibleMissions.length > 0 && !celebrationShownRef.current) {
          celebrationShownRef.current = true
          if (celebrationShowTimerRef.current != null) {
            clearTimeout(celebrationShowTimerRef.current)
          }
          celebrationShowTimerRef.current = window.setTimeout(() => {
            celebrationShowTimerRef.current = null
            setShowCelebration(true)
          }, 700)
        }
        return next
      })

      pendingStatsWritesRef.current += 1
      /**
       * 실제 네트워크 요청은 큐에 넣어 이전 완료 요청이 끝난 뒤 순서대로만 나가게 합니다.
       * (낙관적 UI·카운터 증가는 위에서 이미 즉시 처리됨 — 탭 반응성은 그대로 유지됩니다.)
       */
      const runMissionCompleteRequest = async () => {
        try {
          const res = await fetch('/api/daily-mission/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dailyMissionId: dm.id, today: seoulDayKey, childId }),
          })
          const text = await res.text()
          let json: unknown = {}
          try {
            json = text ? JSON.parse(text) : {}
          } catch {
            /* 응답이 JSON이 아니면 stats 동기화 생략 */
          }
          if (res.ok) {
            setStats((prev) => {
              const next = tryApplyCompletePayload(prev, json)
              if (!next || !prev) return next ?? prev
              /**
               * 연타로 완료 응답 여러 개가 순서 뒤바뀌어 도착할 수 있습니다.
               * total_credits_earned 는 단조 증가하므로, 더 낮은(옛) 응답이
               * 최신 값을 덮어써 크레딧이 되돌아가 보이는 것을 막습니다.
               */
              if (
                readChildStatInt(next.total_credits_earned) <
                readChildStatInt(prev.total_credits_earned)
              ) {
                return prev
              }
              return next
            })
            if (typeof performance !== 'undefined') lastLocalStatsBumpAtRef.current = performance.now()
            if (
              json &&
              typeof json === 'object' &&
              (json as { autoPraiseStickerGranted?: unknown }).autoPraiseStickerGranted === true
            ) {
              void (async () => {
                const supabase = createClient()
                const { data } = await supabase
                  .from('praise_sticker_grants')
                  .select('*')
                  .eq('child_id', childId)
                  .order('created_at', { ascending: false })
                if (data) {
                  setGrants((prev) =>
                    mergePraiseStickerGrantsFromServer(data as PraiseStickerGrant[], prev),
                  )
                  setPraiseGrantsRevision((r) => r + 1)
                }
              })()
              router.refresh()
            }
          } else {
            optimisticDailyMissionCompleteIdsRef.current.delete(dm.id)
            /** 낙관적으로 올려 둔 하트·크레딧을 요청 실패에 맞춰 되돌립니다 */
            setStats((prev) =>
              prev ? rollbackOptimisticMissionMoneyRewards(prev, creditReward, heartReward) : prev,
            )
            rollbackMissionHeartsOptimistic(heartReward)
            if (celebrationShowTimerRef.current != null) {
              clearTimeout(celebrationShowTimerRef.current)
              celebrationShowTimerRef.current = null
            }
            celebrationShownRef.current = false
            setShowCelebration(false)
            setDone((prev) => {
              const next = new Set(prev)
              next.delete(dm.id)
              return next
            })
          }
        } catch {
          optimisticDailyMissionCompleteIdsRef.current.delete(dm.id)
          setStats((prev) =>
            prev ? rollbackOptimisticMissionMoneyRewards(prev, creditReward, heartReward) : prev,
          )
          rollbackMissionHeartsOptimistic(heartReward)
          if (celebrationShowTimerRef.current != null) {
            clearTimeout(celebrationShowTimerRef.current)
            celebrationShowTimerRef.current = null
          }
          celebrationShownRef.current = false
          setShowCelebration(false)
          setDone((prev) => {
            const next = new Set(prev)
            next.delete(dm.id)
            return next
          })
        } finally {
          pendingStatsWritesRef.current = Math.max(0, pendingStatsWritesRef.current - 1)
        }
      }
      missionCompleteRequestQueueRef.current = missionCompleteRequestQueueRef.current.then(
        runMissionCompleteRequest,
        runMissionCompleteRequest,
      )
    },
    [
      seoulDayKey,
      childId,
      triggerBadgeShine,
      visibleMissions,
      bumpHeartsForMissionOptimistic,
      rollbackMissionHeartsOptimistic,
      router,
    ],
  )

  const handleMissionComplete = useCallback(
    (
      dm: DailyMissionWithTemplate,
      cardRect: DOMRect,
      creditReward: number,
      heartReward: number,
    ) => {
      /**
       * 서울 날짜가 이미 넘어갔는데 서버 props가 아직 어제면,
       * 잘못된 날짜(today)로 완료 API를 보내지 않도록 새로고침을 먼저 유도합니다.
       */
      if (seoulDayKey !== today) {
        router.refresh()
        return
      }
      if (done.has(dm.id)) {
        return
      }
      const honesty = getHonestyBlockForMission(dm)
      if (honesty) {
        setHonestyBlockReason(honesty)
        setHonestyModalOpen(true)
        setMissionTapUnblock((prev) => ({
          ...prev,
          [dm.id]: (prev[dm.id] ?? 0) + 1,
        }))
        return
      }

      const now = Date.now()

      /**
       * 연속 탭 감지: 3초 이내 탭 타임스탬프만 남기고,
       * 5개 이상 쌓이면 확인 팝업을 띄웁니다.
       */
      const filtered = recentTapTimestamps.current.filter((t) => now - t < 3000)
      /** 한참 쉬었다가 다시 탭하면 이전 버스트와 섞이지 않도록 id 목록도 비웁니다 */
      if (filtered.length === 0) {
        rapidBurstCommittedIdsRef.current = []
      }
      recentTapTimestamps.current = [...filtered, now]

      if (recentTapTimestamps.current.length >= 5) {
        /** 팝업 대기 중인 미션 정보를 저장하고 팝업을 엽니다 */
        pendingMissionRef.current = { dm, cardRect, creditReward, heartReward }
        setRapidTapModalOpen(true)

        /** 부모에게 연속 탭 알림을 백그라운드로 전송합니다 */
        void fetch('/api/child/rapid-tap-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mission_count: recentTapTimestamps.current.length }),
        }).catch(() => { /* 알림 전송 실패 시 조용히 무시 */ })

        return
      }

      /**
       * 완료 API에 넣기 직전 id 를 기록합니다(최대 4).
       * 5번째는 위에서 return 되므로 여기까지 오지 않습니다.
       */
      rapidBurstCommittedIdsRef.current = [...rapidBurstCommittedIdsRef.current, dm.id].slice(-4)

      /** 연속 탭 감지 통과 — 정상 완료 처리를 진행합니다 */
      commitMissionComplete(dm, cardRect, creditReward, heartReward)
    },
    [done, commitMissionComplete, getHonestyBlockForMission, router, seoulDayKey, today],
  )

  /**
   * 연속 탭 확인 팝업: "정말 다 했어!" 버튼 처리
   * - 보류된 미션을 실제 완료 처리하고 팝업을 닫습니다.
   * - 감지 카운터를 초기화해 직후 탭이 다시 팝업을 띄우지 않도록 합니다.
   */
  const handleRapidTapConfirm = useCallback(() => {
    const p = pendingMissionRef.current
    if (p && !done.has(p.dm.id)) {
      const honesty = getHonestyBlockForMission(p.dm)
      if (honesty) {
        setHonestyBlockReason(honesty)
        setHonestyModalOpen(true)
        setMissionTapUnblock((prev) => ({
          ...prev,
          [p.dm.id]: (prev[p.dm.id] ?? 0) + 1,
        }))
        pendingMissionRef.current = null
        recentTapTimestamps.current = []
        rapidBurstCommittedIdsRef.current = []
        setRapidTapModalOpen(false)
        return
      }
      commitMissionComplete(p.dm, p.cardRect, p.creditReward, p.heartReward)
    }
    pendingMissionRef.current = null
    recentTapTimestamps.current = []
    /** 확인이면 버스트 구간이 끝난 것으로 보고, 다음 연속탭은 새로 셉니다 */
    rapidBurstCommittedIdsRef.current = []
    setRapidTapModalOpen(false)
  }, [done, commitMissionComplete, getHonestyBlockForMission])

  /**
   * 연속 탭 확인 팝업: "미안.. 다시 할게" 버튼 처리
   * - 이미 완료 처리된(최대 4) 미션은 DB·화면에서 되돌리고, 5번째 카드만 탭 잠금을 풉니다.
   */
  const handleRapidTapDeny = useCallback(() => {
    const pending = pendingMissionRef.current
    const toUndo = [...rapidBurstCommittedIdsRef.current]
    pendingMissionRef.current = null
    recentTapTimestamps.current = []
    rapidBurstCommittedIdsRef.current = []
    setRapidTapModalOpen(false)

    // 5번째(팝업을 연) 카드는 완료 처리가 없었지만 탭 잠금만 켜져 있으므로, 키를 올려 다시 탭 가능하게 합니다
    if (pending) {
      setMissionTapUnblock((prev) => ({
        ...prev,
        [pending.dm.id]: (prev[pending.dm.id] ?? 0) + 1,
      }))
    }

    if (toUndo.length === 0) return

    for (const id of toUndo) {
      optimisticDailyMissionCompleteIdsRef.current.delete(id)
    }

    const idSet = new Set(toUndo)
    /**
     * 즉시 로컬에서 카드·완료 집합을 되돌려 눈에 보이는 지연을 줄입니다.
     * 이후 `/api/daily-mission/undo-burst` 로 DB를 맞춥니다(전부 실패 시에만 `router.refresh()`).
     */
    setMissionList((prev) =>
      prev.map((m) =>
        idSet.has(m.id) ? { ...m, is_completed: false, completed_at: null } : m,
      ),
    )
    setDone((prev) => {
      const next = new Set(prev)
      for (const id of toUndo) next.delete(id)
      return next
    })
    setShowCelebration(false)
    celebrationShownRef.current = false
    if (celebrationShowTimerRef.current != null) {
      clearTimeout(celebrationShowTimerRef.current)
      celebrationShowTimerRef.current = null
    }

    void (async () => {
      try {
        const res = await fetch('/api/daily-mission/undo-burst', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dailyMissionIds: toUndo, childId }),
        })
        const raw = await res.text()
        let body: { success?: boolean; failed?: { id: string; error: string }[] } = {}
        try {
          body = raw ? (JSON.parse(raw) as typeof body) : {}
        } catch {
          /* JSON 이 아니면 success 로 간주하지 않음 */
        }
        /**
         * 전부 성공(`success: true`)일 때는 `router.refresh()`를 호출하지 않습니다.
         * RSC/캐시가 잠시 스테일한 `daily_missions` 를 내려주면 useEffect( dailyMissions )가
         * 방금 맞춘 `missionList`/`done` 을 `is_completed: true` 로 덮어써, 카드가 "잠깐 나왔다가 사라짐"처럼 보일 수 있기 때문입니다.
         * 스탯은 기존 Realtime(child_stats) 구독이 서버 갱신을 따라갑니다.
         */
        const apiAllSucceeded = res.ok && body.success === true

        if (apiAllSucceeded) {
          return
        }
        router.refresh()
      } catch {
        router.refresh()
      }
    })()
  }, [childId, router])

  // ── 스티커 상태 ────────────────────────────────────────────────────────────

  const [grants, setGrants] = useState(initialPraiseGrants)
  const [placements, setPlacements] = useState(initialPraisePlacements)
  const [praiseGrantsRevision, setPraiseGrantsRevision] = useState(0)
  const [arrivalOpen, setArrivalOpen] = useState(false)

  useEffect(() => {
    setGrants((prev) => mergePraiseStickerGrantsFromServer(initialPraiseGrants, prev))
  }, [initialPraiseGrants])

  useEffect(() => {
    setPlacements(initialPraisePlacements)
  }, [initialPraisePlacements])

  const refreshStickerPlacements = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('praise_sticker_placements').select('*').eq('child_id', childId)
    if (data) setPlacements(data as PraiseStickerPlacement[])
  }, [childId])

  const clearPraiseStickerBoard = useCallback(
    (clearedAt?: string, meta?: { grantsDeleted?: boolean }) => {
      setPlacements([])
      if (meta?.grantsDeleted) {
        setGrants([])
        setPraiseGrantsRevision((r) => r + 1)
      }
      if (clearedAt) {
        setStats((prev) => (prev ? { ...prev, praise_board_cleared_at: clearedAt } : prev))
      }
    },
    [],
  )

  /** 아직 팝업을 보지 않은 가장 최근 스티커 — 랜덤 발급 이미지 표시용 */
  const pendingArrivalGrant = useMemo(() => {
    const pending = grants.filter((g) => g.popup_dismissed_at == null)
    if (pending.length === 0) return null
    return pending.reduce((latest, g) =>
      new Date(g.created_at) >= new Date(latest.created_at) ? g : latest,
    )
  }, [grants])

  useEffect(() => {
    setArrivalOpen(pendingArrivalGrant != null)
  }, [pendingArrivalGrant])

  const dismissArrival = useCallback(async () => {
    const now = new Date().toISOString()
    setGrants((prev) =>
      prev.map((g) => (g.popup_dismissed_at ? g : { ...g, popup_dismissed_at: now })),
    )
    setArrivalOpen(false)
    const supabase = createClient()
    await supabase
      .from('praise_sticker_grants')
      .update({ popup_dismissed_at: now })
      .eq('child_id', childId)
      .is('popup_dismissed_at', null)
  }, [childId])

  // ── 패널 상태 ──────────────────────────────────────────────────────────────

  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [marketInitialScrollSection, setMarketInitialScrollSection] = useState<
    import('@/lib/parentMarketMenuSections').ParentMarketSectionId | null
  >(null)
  const [contentZoneOpen, setContentZoneOpen] = useState(false)
  const [chestTicketQty, setChestTicketQty] = useState(initialChestTicketQuantity)

  useEffect(() => {
    setChestTicketQty(initialChestTicketQuantity)
  }, [initialChestTicketQuantity])

  /**
   * 이용권 잔액을 못 읽었는지 표시합니다.
   *
   * 왜 필요한가: 못 읽으면 화면에는 0장으로 보이는데, 보물상자는 0장이면
   * 곧바로 마켓으로 보내 버립니다. 서버가 느린 동안 아이가 「보물상자 → 마켓 →
   * 크레딧 없음 → 보물상자」를 끝없이 오가는 상태가 됐습니다.
   * 「정말 0장」과 「아직 모름」을 구분해야 그 반복을 끊을 수 있습니다.
   */
  const [ticketBalanceUnavailable, setTicketBalanceUnavailable] = useState(false)

  const refreshContentTicketBalances = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/content/ticket-balances?childId=${encodeURIComponent(childId)}`,
        { credentials: 'same-origin' },
      )
      if (!res.ok) {
        setTicketBalanceUnavailable(true)
        return
      }
      const json = (await res.json()) as { chestTicketQuantity?: number }
      if (typeof json.chestTicketQuantity === 'number') {
        setChestTicketQty(json.chestTicketQuantity)
        setTicketBalanceUnavailable(false)
      }
    } catch {
      /* 네트워크 실패 시 기존 표시 유지 — 대신 「모름」으로 표시합니다 */
      setTicketBalanceUnavailable(true)
    }
  }, [childId])

  const openContentZone = useCallback(() => {
    void refreshContentTicketBalances()
    setContentZoneOpen(true)
  }, [refreshContentTicketBalances])

  const openMarketToContent = useCallback(() => {
    setMarketInitialScrollSection('content')
    setActivePanel('market')
  }, [])

  const handlePanelClose = useCallback(() => {
    setActivePanel(null)
    setMarketInitialScrollSection(null)
  }, [])

  const handleMarketInitialScrollDone = useCallback(() => {
    setMarketInitialScrollSection(null)
  }, [])

  const handleChestTicketQuantityChange = useCallback((qty: number) => {
    setChestTicketQty(qty)
  }, [])

  const openBearFromGift = useCallback(() => {
    setActivePanel('sticker')
    void dismissArrival()
  }, [dismissArrival])

  // ── 기능 해금 ─────────────────────────────────────────────────────────────

  const features = useMemo(
    () => getUnlockedFeatures(stats?.current_level ?? 0, ageYears),
    [stats?.current_level, ageYears],
  )

  /**
   * 진행 중 시청 세션이 있으면 콘텐츠존을 **한 번만** 자동으로 엽니다 (보물상자 해금 후).
   *
   * 왜 「한 번만」인가: 예전에는 이 조건이 유지되는 한 계속 다시 열려서,
   * 아이가 닫아도 팝업이 또 뜨는 상태가 반복됐습니다.
   * (서버가 느려 이용권 잔액을 못 읽으면 0장으로 보여 마켓으로 튕기고,
   *  돌아오면 이 effect 가 또 열어 무한히 오가는 상태가 됐습니다.)
   */
  const autoOpenedContentZoneRef = useRef(false)
  useEffect(() => {
    if (autoOpenedContentZoneRef.current) return
    if (!features.contentZone) return
    if (!initialActiveContentSession?.playlist_url) return
    const rem =
      initialActiveContentSession.remaining_play_seconds != null &&
      initialActiveContentSession.remaining_play_seconds > 0
        ? initialActiveContentSession.remaining_play_seconds
        : remainingContentSeconds(
            initialActiveContentSession.started_at,
            initialActiveContentSession.duration_minutes,
          )
    if (rem > 0 && toYouTubeContentEmbedUrl(initialActiveContentSession.playlist_url)) {
      autoOpenedContentZoneRef.current = true
      setContentZoneOpen(true)
    }
  }, [initialActiveContentSession, features.contentZone])

  // ── 캐릭터 스프라이트 ─────────────────────────────────────────────────────

  const characterSprite = useMemo(
    () => resolveHomeIslandStageSprite(childAvatarUrl),
    [childAvatarUrl],
  )

  /** 배경 앵커 상수 */
  const anchor = BACKGROUND_ANCHORS.kids_background

  /**
   * 토끼·수달 프로필일 때 홈 무대 배율을 곱합니다.
   * 비개발자: 토끼는 `BUNNY_HOME_DISPLAY_SCALE`(좁은 화면 최소 크기 조정), 수달은 `OTTER_HOME_DISPLAY_SCALE` 을 씁니다.
   */
  const homeCharacterSizeMultiplier =
    characterSprite.character === 'bunny'
      ? BUNNY_HOME_DISPLAY_SCALE
      : characterSprite.character === 'otter'
        ? OTTER_HOME_DISPLAY_SCALE
        : 1

  /** 비개발자: 토끼/수달/병아리/햄스터는 각각 상한을 두고, 그 외 캐릭터는 최대 1.3배까지 허용합니다. */
  const characterUiMaxScale =
    characterSprite.character === 'bunny'
      ? BUNNY_CHARACTER_UI_SCALE_MAX
      : characterSprite.character === 'otter'
        ? OTTER_CHARACTER_UI_SCALE_MAX
        : characterSprite.character === 'chicks'
          ? CHICK_CHARACTER_UI_SCALE_MAX
          : characterSprite.character === 'hamster'
            ? HAMSTER_CHARACTER_UI_SCALE_MAX
        : OTHER_CHARACTER_UI_SCALE_MAX

  /** 캐릭터 표시 높이 (px) — 배경 높이의 characterScale 비율(토끼는 추가 배율 적용) */
  /**
   * 캐릭터 배율(가로 반응형): 화면 가로에 따라 커집니다.
   * - 토끼/수달의 개별 보정은 유지합니다.
   * - 병아리는 최소 2/3배 ~ 최대 1배 전용 곡선을 사용합니다.
   * - 햄스터는 최소 2/3배 ~ 최대 1.1배 전용 곡선을 사용합니다.
   * - 최종 상한은 토끼 1.35배, 수달 1.5배, 병아리 1배, 햄스터 1.1배, 그 외 캐릭터 1.3배입니다.
   */
  const characterUiScale = useMemo(
    () =>
      characterSprite.character === 'chicks'
        ? scaleForChickUi(containerW)
        : characterSprite.character === 'hamster'
          ? scaleForHamsterUi(containerW)
        : Math.min(characterUiMaxScale, homeCharacterSizeMultiplier * scaleForCharacterUi(containerW)),
    [characterSprite.character, characterUiMaxScale, containerW, homeCharacterSizeMultiplier],
  )

  const characterDisplayH =
    containerH > 0
      ? Math.round(containerH * anchor.characterScale * characterUiScale)
      : 0

  /** 상단 왼쪽(레벨·크레딧 통합 카드) — 컨테이너 가로가 넓어질수록 최대 1.7배(글자·아이콘 동일 비율) */
  const levelBlockScale = useMemo(() => scaleForLevelBlock(containerW), [containerW])

  /** 상단 우측: 나가기·스티커·장바구니 묶음 — 반응형 스케일 상한은 `RIGHT_ICON_PRIMARY_SCALE_MAX` */
  const rightIconPrimaryScale = useMemo(() => scaleForRightIconPrimary(containerW), [containerW])

  /** 발 옆 저금통·화분 UI 크기 — `scaleForPlantFeetUi` 결과에 1.5를 곱해, 좁은 폭에서도 너무 작아 보이지 않게 합니다 */
  const plantFeetUiScale = useMemo(
    () => {
      const base = scaleForPlantFeetUi(containerW)
      return base * 1.5
    },
    [containerW],
  )

  /**
   * 발 옆 화분·물조리개 가로 % — 토끼 중심과의 **픽셀 간격**을 885px 레이아웃과 동일하게 유지(좁은 화면에서 안 줄어듦)
   */
  const plantFeetAnchorsPct = useMemo(
    () =>
      plantFeetAnchorsKeepRugGapPx(
        containerW,
        anchor.rugCenterX,
        anchor.plantPotBesideLeftFootX,
        anchor.wateringCanBesideRightFootX,
        PLANT_FEET_LAYOUT_REFERENCE_W,
      ),
    [
      containerW,
      anchor.rugCenterX,
      anchor.plantPotBesideLeftFootX,
      anchor.wateringCanBesideRightFootX,
    ],
  )

  /**
   * 저금통(왼쪽)·화분(오른쪽) 추가 벌림(%):
   * - 640px 이하에서는 0% (좁은 폰에서만 기본 앵커만 사용)
   * - 그보다 넓어질수록 최대 3.2%까지 양쪽으로 더 벌립니다(쌍둥이 간격 = 2배 체감).
   * - 램프 끝 1200px로 두어 중간 폭에서 t가 빨리 오릅니다.
   */
  const piggyPotExtraSpreadPct = useMemo(() => {
    if (!(containerW > 0) || containerW <= 640) return 0
    const t = Math.min(1, (containerW - 640) / (1200 - 640))
    return 3.2 * t
  }, [containerW])

  /** 저금통 해금 기준 레벨 — 레벨 5 */
  const piggyUnlockLevel = PIGGY_BANK_UNLOCK_MIN_LEVEL
  /** 현재 저금통 UI·저금이 열린 상태인지 */
  const piggyUnlocked = useMemo(
    () => isPiggyBankUnlocked(stats?.current_level ?? 0),
    [stats?.current_level],
  )
  const piggyDepositEnabled = piggyUnlocked
  /** 해금 축하 + 튜토리얼 플로우 모달 */
  const [piggyUnlockFlowOpen, setPiggyUnlockFlowOpen] = useState(false)
  const piggyUnlockSeenRef = useRef(false)
  const piggyTutorialSkipRef = useRef(false)
  const piggyBootstrapDoneRef = useRef(false)
  /** 스티커 아이콘(레벨 1) 해금 축하 모달 */
  const [stickerUnlockFlowOpen, setStickerUnlockFlowOpen] = useState(false)
  const stickerUnlockSeenRef = useRef(false)
  const stickerTutorialSkipRef = useRef(false)
  const stickerBootstrapDoneRef = useRef(false)
  /** 레벨 0→5 등 한 번에 여러 기능이 풀릴 때 저금통 팝업을 스티커 뒤로 미룹니다 */
  const pendingPiggyUnlockAfterStickerRef = useRef(false)
  /** 스티커·저금통 축하 뒤 보물상자 팝업을 미룹니다 */
  const pendingContentZoneUnlockRef = useRef(false)
  /** 보물상자(레벨 8) 해금 축하 모달 */
  const [contentZoneUnlockFlowOpen, setContentZoneUnlockFlowOpen] = useState(false)
  const contentZoneUnlockSeenRef = useRef(false)
  const contentZoneBootstrapDoneRef = useRef(false)
  const prevLevelRef = useRef(stats?.current_level ?? 0)

  /**
   * 자녀별 로컬 persistence 로드.
   * - 기존에 이미 레벨 5 이상인 사용자에게는 팝업을 다시 띄우지 않도록 기본값을 즉시 "본 상태"로 저장합니다.
   */
  useEffect(() => {
    piggyBootstrapDoneRef.current = false
  }, [childId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (piggyBootstrapDoneRef.current) return
    const currentLevel = stats?.current_level
    if (typeof currentLevel !== 'number') return
    const seenKey = piggyUnlockSeenStorageKey(childId)
    const skipKey = piggyTutorialSkipStorageKey(childId)
    const seen = window.localStorage.getItem(seenKey) === '1'
    const skipped = window.localStorage.getItem(skipKey) === '1'
    piggyUnlockSeenRef.current = seen
    piggyTutorialSkipRef.current = skipped
    prevLevelRef.current = currentLevel
    piggyBootstrapDoneRef.current = true

    if (currentLevel >= piggyUnlockLevel && !seen) {
      window.localStorage.setItem(seenKey, '1')
      piggyUnlockSeenRef.current = true
    }
  }, [childId, piggyUnlockLevel, stats?.current_level])

  /**
   * 레벨업 직후 기능 해금(스티커·저금통) — 교차 순간에만 축하 팝업
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!piggyBootstrapDoneRef.current || !stickerBootstrapDoneRef.current || !contentZoneBootstrapDoneRef.current) return
    const currentLevel = stats?.current_level ?? 0
    const previousLevel = prevLevelRef.current

    const stickerCross =
      previousLevel < STICKER_UNLOCK_MIN_LEVEL &&
      currentLevel >= STICKER_UNLOCK_MIN_LEVEL &&
      !stickerUnlockSeenRef.current

    const piggyCross =
      previousLevel < piggyUnlockLevel &&
      currentLevel >= piggyUnlockLevel &&
      !piggyUnlockSeenRef.current

    const contentZoneCross =
      previousLevel < CONTENT_ZONE_UNLOCK_MIN_LEVEL &&
      currentLevel >= CONTENT_ZONE_UNLOCK_MIN_LEVEL &&
      !contentZoneUnlockSeenRef.current

    if (stickerCross) {
      stickerUnlockSeenRef.current = true
      window.localStorage.setItem(stickerUnlockSeenStorageKey(childId), '1')
      setStickerUnlockFlowOpen(true)
    }

    if (piggyCross) {
      piggyUnlockSeenRef.current = true
      window.localStorage.setItem(piggyUnlockSeenStorageKey(childId), '1')
      if (stickerCross) {
        pendingPiggyUnlockAfterStickerRef.current = true
      } else {
        setPiggyUnlockFlowOpen(true)
      }
    }

    if (contentZoneCross) {
      contentZoneUnlockSeenRef.current = true
      window.localStorage.setItem(contentZoneUnlockSeenStorageKey(childId), '1')
      if (stickerCross || piggyCross) {
        pendingContentZoneUnlockRef.current = true
      } else {
        setContentZoneUnlockFlowOpen(true)
      }
    }

    prevLevelRef.current = currentLevel
  }, [childId, piggyUnlockLevel, stats?.current_level])

  /**
   * 스티커 아이콘 해금(레벨 1) — 기존 사용자 bootstrap
   */
  useEffect(() => {
    stickerBootstrapDoneRef.current = false
  }, [childId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (stickerBootstrapDoneRef.current) return
    const currentLevel = stats?.current_level
    if (typeof currentLevel !== 'number') return
    const seenKey = stickerUnlockSeenStorageKey(childId)
    const skipKey = stickerTutorialSkipStorageKey(childId)
    const seen = window.localStorage.getItem(seenKey) === '1'
    const skipped = window.localStorage.getItem(skipKey) === '1'
    stickerUnlockSeenRef.current = seen
    stickerTutorialSkipRef.current = skipped
    stickerBootstrapDoneRef.current = true

    if (currentLevel >= STICKER_UNLOCK_MIN_LEVEL && !seen) {
      window.localStorage.setItem(seenKey, '1')
      stickerUnlockSeenRef.current = true
    }
  }, [childId, stats?.current_level])

  /**
   * 보물상자(레벨 8) — 기존 사용자 bootstrap
   */
  useEffect(() => {
    contentZoneBootstrapDoneRef.current = false
  }, [childId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (contentZoneBootstrapDoneRef.current) return
    const currentLevel = stats?.current_level
    if (typeof currentLevel !== 'number') return
    const seenKey = contentZoneUnlockSeenStorageKey(childId)
    const seen = window.localStorage.getItem(seenKey) === '1'
    contentZoneUnlockSeenRef.current = seen
    contentZoneBootstrapDoneRef.current = true

    if (currentLevel >= CONTENT_ZONE_UNLOCK_MIN_LEVEL && !seen) {
      window.localStorage.setItem(seenKey, '1')
      contentZoneUnlockSeenRef.current = true
    }
  }, [childId, stats?.current_level])

  const closeStickerUnlockFlow = useCallback(() => {
    setStickerUnlockFlowOpen(false)
    if (pendingPiggyUnlockAfterStickerRef.current) {
      pendingPiggyUnlockAfterStickerRef.current = false
      setPiggyUnlockFlowOpen(true)
      return
    }
    if (pendingContentZoneUnlockRef.current) {
      pendingContentZoneUnlockRef.current = false
      setContentZoneUnlockFlowOpen(true)
    }
  }, [])

  const closePiggyUnlockFlow = useCallback(() => {
    setPiggyUnlockFlowOpen(false)
    if (pendingContentZoneUnlockRef.current) {
      pendingContentZoneUnlockRef.current = false
      setContentZoneUnlockFlowOpen(true)
    }
  }, [])

  /** 저금통 팝업에서 가용·저금통 잔액을 반영합니다. */
  const patchPiggyFromHome = useCallback((p: { credits: number; credits_piggy: number }) => {
    /**
     * 옮기기 직후 짧은 창 동안은 뒤늦게 도착한 서버 알림이 이 값을 덮어쓰지 않게 합니다.
     * (미션 완료와 같은 보호 — 예전에는 저금통 쪽에만 이 표시가 없어서, 마지막 옮기기가 끝나
     *  대기 카운터가 0이 되는 순간 밀린 옛 알림들이 들어와 숫자가 왔다갔다 했습니다.)
     */
    if (typeof performance !== 'undefined') lastLocalStatsBumpAtRef.current = performance.now()
    setStats((prev) => (prev ? mergeChildStatsPatch(prev, p) : prev))
  }, [])

  const setPiggyTransferPending = useCallback((pending: boolean) => {
    pendingStatsWritesRef.current = Math.max(0, pendingStatsWritesRef.current + (pending ? 1 : -1))
  }, [])

  const availableCreditsForHome = readChildStatInt(stats?.credits)

  return (
    <>
      {/**
       * 전체 화면 컨테이너 — fixed inset-0 로 ChildNavBar(z-50), 레이아웃 나가기 버튼(z-50) 위에 올립니다.
       * 비개발자 설명: 이 화면이 기존 탭 바를 완전히 가리고 단일 화면으로 동작합니다.
       */}
      <div
        ref={containerRef}
        className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
      >
        {/* ── L1: 배경 이미지 ─────────────────────────────────────────────── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/*
          배경 `objectPosition` x% = imageObjectPositionX(50=중앙, 작을수록 왼쪽·클수록 오른쪽)
        */}
        <img
          src={`${ASSETS.layouts.childHomeBackgroundSecondScreen}?v=${CHILD_HOME_BACKGROUND_CACHE_BUST}`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover brightness-[1.1] pointer-events-none select-none"
          style={{ objectPosition: `${anchor.imageObjectPositionX + 2}% 50%` }}
          draggable={false}
          fetchPriority="high"
          loading="eager"
          decoding="async"
        />

        {/* ── L2: 캐릭터 ──────────────────────────────────────────────────── */}
        {characterDisplayH > 0 && (
          <button
            type="button"
            className="absolute z-10 cursor-pointer border-0 bg-transparent p-0"
            style={{
              left: `${anchor.rugCenterX * 100}%`,
              top: `${anchor.characterFootY * 100}%`,
              transform: 'translate(-50%, -100%)',
            }}
            onClick={() => {
              setDiaryInitialDate(today)
              setIsDiaryOpen(true)
            }}
            aria-label="그림일기 다이어리 열기"
          >
            <CharacterSprite
              character={characterSprite.character}
              frame={characterSprite.frame}
              width={Math.round(characterDisplayH * (characterSprite.width / characterSprite.height))}
              height={characterDisplayH}
              className="pointer-events-none select-none"
              style={
                characterSprite.character === 'chicks'
                  ? { clipPath: `inset(0 0 0 ${CHICK_HOME_ISLAND_CLIP_LEFT_PX}px)` }
                  : undefined
              }
            />
          </button>
        )}

        {/* ── L3: UI 오버레이 ──────────────────────────────────────────────── */}
        <div className="absolute inset-0 z-20 flex flex-col pointer-events-none">

          {/*
            상단: 왼쪽 레벨 카드(카드 아래: 뽀모도로·음악) / 발 옆 저금통·화분(절대 배치) / 우측 나가기·스티커…
          */}
          <div
            className="flex w-full items-start justify-between gap-3 px-4"
            style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
          >
            <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col items-start gap-2">
              {stats ? (
                <>
                  <div
                    className="pointer-events-none grid w-max min-w-0 max-w-full grid-cols-1 gap-0"
                    style={{
                      transformOrigin: 'top left',
                      transform: `scale(${levelBlockScale})`,
                    }}
                  >
                    <ChildLevelStatsCard
                      stats={stats}
                      creditRef={creditBadgeRef}
                      heartRef={levelHeartsRef}
                      shine={badgeShine}
                      heartsCount={heartsForHomeUi}
                    />
                    {/*
                      레벨 블록 아래 한 줄: 왼쪽 뽀모도로, 오른쪽 음악.
                      카드와 같은 스케일 컨테이너 안에 넣어, 화면이 넓어져도 서로 겹치지 않게 유지합니다.
                    */}
                    <div className="pointer-events-auto mt-2 w-[168px] max-w-full translate-x-1 translate-y-1">
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => setClockPopupOpen(true)}
                        className={`${CHILD_HOME_RIGHT_ICON_GLASS_CLASS} scale-[1.2] border-0 bg-transparent p-0 transition-transform active:scale-90`}
                          style={CHILD_HOME_TOP_BAR_GLASS_STYLE}
                          aria-label="뽀모도로·알람 팝업 열기"
                        >
                          <SpriteImage
                            sheet={ICONS}
                            frame="timer"
                            width={28}
                            className="h-7 w-7 shrink-0 translate-x-[2px] select-none object-contain drop-shadow-md"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMusicPopupOpen(true)}
                        className={`${CHILD_HOME_RIGHT_ICON_GLASS_CLASS} -ml-8 translate-x-1 scale-[1.2] border-0 bg-transparent p-0 transition-transform active:scale-90`}
                          style={CHILD_HOME_TOP_BAR_GLASS_STYLE}
                          aria-label="하루를 돕는 음악 팝업 열기"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/assets/img/common/ui/music.png"
                            alt=""
                            width={21}
                            height={21}
                            className="h-[21px] w-[21px] -translate-x-[2px] object-contain drop-shadow-md"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
              {badgeShine && creditBadgeRef.current ? (
                <BadgeStarBurst badgeRef={creditBadgeRef} />
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-3 pointer-events-auto">
              {/*
                나가기·스티커·장바구니를 한 묶음으로 스케일 — 컨테이너 가로에 따라 `scaleForRightIconPrimary`.
              */}
              <div
                className="flex flex-col items-end gap-3"
                style={{
                  transformOrigin: 'top right',
                  transform: `scale(${rightIconPrimaryScale})`,
                }}
              >
                <button
                  type="button"
                  onClick={handleExitClick}
                  disabled={isExiting}
                  className={`${CHILD_HOME_EXIT_STICKER_CART_GLASS_CLASS} border-0 bg-transparent p-0 no-underline transition active:scale-95 disabled:pointer-events-none`}
                  style={CHILD_HOME_TOP_BAR_GLASS_STYLE}
                  aria-label="나가기"
                  aria-busy={isExiting}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/img/common/ui/exit.png"
                    alt=""
                    width={28}
                    height={28}
                    // 버튼 블록은 고정하고, 나가기 문 아이콘 그림만 오른쪽으로 아주 미세하게 이동합니다.
                    className="h-7 w-7 translate-x-[1px] object-contain drop-shadow-md"
                  />
                </button>
                {features.sticker && (
                  <button
                    type="button"
                    onClick={() => setActivePanel('sticker')}
                    className={`${CHILD_HOME_EXIT_STICKER_CART_GLASS_CLASS} border-0 bg-transparent p-0 transition active:scale-95`}
                    style={CHILD_HOME_TOP_BAR_GLASS_STYLE}
                    aria-label="칭찬 스티커 판 열기"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/assets/img/common/ui/luckybox.png"
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain drop-shadow-md"
                    />
                  </button>
                )}
                {features.contentZone && (
                  <button
                    type="button"
                    onClick={openContentZone}
                    className={`${CHILD_HOME_EXIT_STICKER_CART_GLASS_CLASS} relative border-0 bg-transparent p-0 transition active:scale-95`}
                    style={CHILD_HOME_TOP_BAR_GLASS_STYLE}
                    aria-label={`보물상자 열기, 보물상자 티켓 ${chestTicketQty}개`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={CHILD_CONTENT_TREASURE_ICON_URL}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain drop-shadow-md"
                      draggable={false}
                    />
                    {chestTicketQty > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-white">
                        {chestTicketQty > 99 ? '99+' : chestTicketQty}
                      </span>
                    ) : null}
                  </button>
                )}
                {features.market && (
                  <button
                    type="button"
                    onClick={() => setActivePanel('market')}
                    className={`${CHILD_HOME_EXIT_STICKER_CART_GLASS_CLASS} border-0 bg-transparent p-0 transition active:scale-95`}
                    style={CHILD_HOME_TOP_BAR_GLASS_STYLE}
                    aria-label="마켓 열기"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/assets/img/common/ui/basket_filled.png"
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain drop-shadow-md"
                    />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/*
            발 옆 — 저금통(`plantPct`)은 화분 로딩과 무관하게 바로 배치합니다.
            화분(`canPct`)만 pot 데이터가 준비된 뒤 표시합니다(로딩 중 위치 점프 방지).
            물조리개는 화분 팝업 안에서만 사용합니다.
          */}
          {piggyUnlocked && stats ? (
            <div
              className="pointer-events-auto absolute z-[21]"
              style={{
                left: `${plantFeetAnchorsPct.plantPct - piggyPotExtraSpreadPct}%`,
                top: `${anchor.characterFootY * 100}%`,
                transform: 'translate(-50%, calc(-90% - 28px))',
              }}
            >
              <div
                className="flex flex-col items-center"
                style={{
                  transform: `scale(${plantFeetUiScale})`,
                  transformOrigin: 'center bottom',
                }}
              >
                        <ChildHomePiggyBank
                    availableCredits={availableCreditsForHome}
                    piggyCredits={readChildStatInt(stats.credits_piggy)}
                    childId={childId}
                    depositEnabled={piggyDepositEnabled}
                    levelCreditRef={creditBadgeRef}
                    onPiggyUpdate={patchPiggyFromHome}
                    onPiggyTransferPending={setPiggyTransferPending}
                    bonusPending={piggyBonusPending}
                    onBonusClaimed={({ pending, credits }) => {
                      setPiggyBonusPending(pending)
                      /** 보너스 코인도 같은 보호 창을 엽니다(옛 알림이 덮어쓰지 않도록) */
                      if (typeof performance !== 'undefined') {
                        lastLocalStatsBumpAtRef.current = performance.now()
                      }
                      setStats((prev) =>
                        normalizeChildStatsCreditsSplit(mergeChildStatsPatch(prev, { credits })),
                      )
                    }}
                  />
              </div>
            </div>
          ) : null}
          {!plantLoading && pot && stats ? (
            <div
              className="pointer-events-auto absolute z-[21]"
              style={{
                left: `${plantFeetAnchorsPct.canPct + piggyPotExtraSpreadPct}%`,
                top: `${anchor.characterFootY * 100}%`,
                transform: getPlantPotHomeShellTransform(
                  pot.treeId,
                  pot.stage,
                  needsPotSeedSelection(pot),
                ),
              }}
            >
              <div
                className="flex flex-col items-center"
                style={{
                  transform: `scale(${plantFeetUiScale})`,
                  transformOrigin: 'center bottom',
                }}
              >
                <PlantPot
                  pot={pot}
                  celebrationActive={plantCelebrateStage !== null}
                  seedSelect={{
                    currentCredits: creditsAvailable(stats ?? { credits: 0 }),
                    onSelect: buySeed,
                    onPlanted: () => void refreshHarvestInventory(),
                  }}
                  waterActions={
                    pot.hasChosenSeed && !needsPotSeedSelection(pot)
                      ? {
                          /** 물조리개 그림·탭 판정은 레벨 카드와 같은 `heartsForHomeUi` 기준 */
                          hearts: heartsForHomeUi,
                          allowWaterWithoutHearts: pot.stage === 7,
                          locked: plantStageLocked,
                          water: () => water(heartsForHomeUi),
                          onNoHearts: () =>
                            setPlantHint('하트가 부족해요! 미션을 하면 하트를 받을 수 있어요.'),
                          onGrowthCelebrate: handlePlantGrowthCelebrate,
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          ) : null}

          {plantHint ? (
            /**
             * 하트 부족 안내:
             * - 화면 중앙에 메시지를 띄우고
             * - 손가락 이미지가 아래 "오늘의 미션" 카드 영역을 가리키도록 배치합니다.
             */
            <div className="pointer-events-none absolute inset-0 z-[30]">
              <style>{`
                @keyframes missionHintSweep {
                  0% { top: -34%; opacity: 0; }
                  20% { opacity: 0.5; }
                  80% { opacity: 0.5; }
                  100% { top: 100%; opacity: 0; }
                }
                @keyframes pointerBounceVertical {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(10px); }
                }
              `}</style>
              <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2">
                <p className="max-w-[15rem] rounded-xl bg-black/75 px-3 py-2 text-center text-[12px] font-black leading-snug text-white shadow-lg">
                  {plantHint}
                </p>
              </div>
              <div
                className="absolute left-1/2 top-[56%] -translate-x-1/2 rotate-90"
                style={{ animation: 'pointerBounceVertical 0.9s ease-in-out infinite' }}
              >
                <Image
                  src="/assets/img/characters/pointing/pointing_under.png"
                  alt="아래 미션 카드를 가리키는 손가락"
                  width={76}
                  height={110}
                  className="h-auto w-[58px] object-contain drop-shadow-[10px_12px_12px_rgba(0,0,0,0.35)]"
                  priority
                />
              </div>
            </div>
          ) : null}
          {/* ── 스페이서 ────────────────────────────────────────────────── */}
          <div className="flex-1" />

          {/* ── 하단: 미션 섹션 (max-h로 화면 45% 이내로 제한) ─────────── */}
          {/**
           * 비개발자: 카드 크기는 가로(폭)를 기준으로 키워지는데, 이 블록은 세로로 화면의 약 절반만 씁니다.
           * 가로모드·짧은 화면에서는 카드가 이 박스보다 더 길어질 수 있어요. 그때 밖으로 넘치면
           * 바깥 전체 화면이 `overflow-hidden` 이라 **아래가 잘려 깨져 보일** 수 있습니다.
           * `overflow-y-auto` 로 이 구역 안에서만 위아래로 살짝 움직이게 해 잘림을 막습니다.
           */}
          <div
            ref={missionSectionRef}
            className="pointer-events-auto relative flex max-h-[45vh] min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            {plantHint ? (
              <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden rounded-2xl">
                <div className="absolute inset-0 rounded-2xl ring-2 ring-pink-300/70 animate-pulse" />
                <div
                  className="absolute left-0 h-[34%] w-full bg-gradient-to-b from-transparent via-white/45 to-transparent"
                  style={{ animation: 'missionHintSweep 1.4s ease-in-out infinite' }}
                />
              </div>
            ) : null}
            {/* 미션 헤더 — 오른쪽: 완주 하트 5칸 → 완료 수/전체(예: 10/19) */}
            <div
              className={`mb-2 flex shrink-0 items-center justify-between gap-2 px-5 transition-all duration-500 ease-out min-[400px]:px-6 ${
                enterReveal ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
              }`}
              style={{ transitionDelay: '50ms' }}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="min-w-0 text-[clamp(0.875rem,calc(0.8rem+0.2vw),1.125rem)] font-black text-white drop-shadow">오늘의 미션</p>
                {/**
                  * 새로고침 — 동그란 배경이 아이콘보다 작아 아래로 밀리고 찌그러져 보였습니다.
                  * 배경을 키우고(h-6 w-6) 아이콘을 가운데 정렬해 깔끔한 새로고침 모양으로 맞췄습니다.
                  */}
                <button
                  type="button"
                  onClick={() => void handleChildHomeRefresh()}
                  disabled={missionSyncing}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition active:scale-90 disabled:opacity-60"
                  aria-label={missionSyncing ? '오늘의 미션 불러오는 중' : '오늘의 미션 새로고침'}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-3.5 w-3.5 ${missionSyncing ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 11a8 8 0 1 0 2 5.3" />
                    <path d="M20 4v7h-7" />
                  </svg>
                </button>
              </div>
              {/**
                * 「계산 중」은 여기 두지 않습니다.
                * 저금통 저장 상태를 미션 카드 옆에 띄웠더니, 저금통을 옮기는데
                * 미션이 새로 불러와지는 것처럼 보여 오히려 혼란스러웠습니다.
                * 저장 안내는 그 일이 일어나는 자리(저금통 팝업)에서만 보여 줍니다.
                */}
              {visibleMissions.length > 0 ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  {/**
                   * 오늘의 미션 진행도 바(0~100%).
                   * 기존 하트 5칸 대신 베이비핑크 게이지가 부드럽게 차오릅니다.
                   */}
                  <div
                    className="relative h-2.5 w-[112px] overflow-hidden rounded-full ring-1 ring-white/45"
                    style={{ background: 'rgba(255,255,255,0.28)' }}
                    role="progressbar"
                    aria-label={`오늘의 미션 진행도 ${filledHearts}/5`}
                    aria-valuenow={filledHearts}
                    aria-valuemin={0}
                    aria-valuemax={5}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(0, Math.min(100, (filledHearts / 5) * 100))}%`,
                        background: 'linear-gradient(90deg, #FDC5D7 0%, #FF9FC2 100%)',
                        boxShadow: '0 0 10px rgba(253,197,215,0.68)',
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-[clamp(0.7rem,calc(0.65rem+0.12vw),0.85rem)] font-bold tabular-nums text-white/80 drop-shadow">
                    {visibleMissions.filter((dm) => done.has(dm.id)).length}/{visibleMissions.length}
                  </span>
                </div>
              ) : null}
            </div>

            {/* 미션 카드 가로 스크롤 */}
            {visibleMissions.length === 0 ? (
              <div className="px-5 min-[400px]:px-6">
                {/**
                  * 카드가 없을 때의 세 가지 상태.
                  * 불러오는 중 → 오류 → 정말 없음 순으로 판단합니다.
                  * 「없음」은 잠깐 기다려 확정된 뒤에만 보여 줍니다(로딩을 없음으로 오해하지 않게).
                  */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-5 text-center">
                  {missionSyncing || (!missionSyncError && !missionEmptyConfirmed) ? (
                    <>
                      <p className="flex items-center justify-center gap-2 text-sm font-bold text-gray-600">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4 shrink-0 animate-spin"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M20 11a8 8 0 1 0 2 5.3" />
                          <path d="M20 4v7h-7" />
                        </svg>
                        미션 카드를 불러오는 중이에요
                      </p>
                      <p className="mt-1 text-xs text-gray-400">잠시만 기다려 주세요.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-gray-600">
                        {missionSyncError ? '미션을 불러오지 못했어요' : '아직 미션이 없어요'}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {missionSyncError
                          ? '아래 새로고침을 눌러 다시 불러와 주세요.'
                          : '부모님이 미션을 만들어주실 거예요!'}
                      </p>
                      {/* 비었을 때는 여기서도 바로 다시 불러올 수 있게 합니다 */}
                      <button
                        type="button"
                        onClick={() => void handleChildHomeRefresh()}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3.5 py-2 text-xs font-bold text-gray-600 transition active:scale-95"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M20 11a8 8 0 1 0 2 5.3" />
                          <path d="M20 4v7h-7" />
                        </svg>
                        새로고침
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : incompleteOrdered.length === 0 ? (
              // 모든 미션 완료 상태에서 하단 미션 카드 영역에 축하 문구·캐릭터 이미지만 보여 줍니다(박스 배경 사진 없음).
              <div className="shrink-0 px-5 min-[400px]:px-6">
                <div
                  // 캐릭터를 2배로 키운 뒤에도 여백이 남도록 최소 높이를 함께 늘립니다.
                  className="relative flex min-h-[528px] items-center justify-center overflow-hidden rounded-2xl border border-gray-200/70 bg-white/85 px-4 py-6 text-center shadow-[0_10px_26px_rgba(0,0,0,0.18)] backdrop-blur-sm"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    {/*
                     * 하단 블록은 `congrats_ready.png`(준비 완료 느낌 이미지), 미션 완료 팝업은 `congrats.png` 로 구분합니다.
                     * 비개발자: 홈 탭에서는 이 그림만 보이도록 하고요, 같은 그림이라도 이름이 헷갈리지 않게 파일을 나눴어요.
                     */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/assets/img/characters/onboarding/congrats_ready.png"
                      alt="모든 미션 완료 — 준비 완료 축하 이미지"
                      width={336}
                      height={336}
                      className="relative z-[1] block h-auto w-[304px] max-w-full shrink-0 select-none object-contain"
                      draggable={false}
                      loading="eager"
                      decoding="async"
                    />
                    <p className="text-lg font-black text-gray-800 drop-shadow-none">
                      모든 미션을 완료했어요!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="flex snap-x snap-mandatory flex-row overflow-x-auto px-5 pb-3 pt-1 min-[400px]:px-6 [scrollbar-width:none] [scroll-padding-left:1.25rem] [scroll-padding-right:1.25rem] min-[400px]:[scroll-padding-left:1.5rem] min-[400px]:[scroll-padding-right:1.5rem] [gap:clamp(0.75rem,calc(0.5rem+0.9vw),1.25rem)] [&::-webkit-scrollbar]:hidden"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {incompleteOrdered.map((mission, idx) => {
                  /**
                   * 부모 루틴과 같은 기준(`isAfternoonMission`): 오전 블록/morning·정오 전 시각 → 오후 블록 또는 12시 이후 시각.
                   * 바로 앞 카드가 오전이고 현재 카드가 오후일 때만 세로 구분선을 넣어 가로 스크롤 줄에서 구역이 보이게 합니다.
                   */
                  const prev = idx > 0 ? incompleteOrdered[idx - 1] : null
                  const showMorningAfternoonDivider =
                    prev != null && !isAfternoonMission(prev) && isAfternoonMission(mission)

                  const revealDelayMs = Math.min(idx, 6) * 45 + 60

                  return (
                    <Fragment key={mission.id}>
                      {showMorningAfternoonDivider ? (
                        <div
                          role="separator"
                          aria-hidden
                          className="pointer-events-none shrink-0 self-stretch w-px min-h-[5rem] bg-white/45 shadow-[1px_0_0_rgba(0,0,0,0.08)] mx-[clamp(2px,calc(0.25rem+0.2vw),6px)]"
                        />
                      ) : null}
                      <div
                        className={`shrink-0 snap-center transition-all duration-500 ease-out ${
                          enterReveal ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                        }`}
                        style={{ transitionDelay: `${revealDelayMs}ms` }}
                      >
                        <ChildMissionCard
                          mission={mission}
                          tapResetKey={missionTapUnblock[mission.id] ?? 0}
                          onComplete={handleMissionComplete}
                        />
                      </div>
                    </Fragment>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── L4: 파티클 레이어 — 최상위 z-index, 클릭 통과 ─────────── */}
        {/* 비개발자 설명: 코인/하트가 이 레이어에서 날아다닙니다. */}
        <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden" aria-hidden>
          {particles.map((p) => (
            <MissionParticle key={p.id} particle={p} />
          ))}
        </div>
      </div>

      {/* ── L5: 패널 오버레이 ─────────────────────────────────────────────── */}
      <ChildPanelOverlay
        active={activePanel}
        onClose={handlePanelClose}
        childId={childId}
        features={features}
        marketEligibleItems={marketEligibleItems}
        initialHiddenStoreItemIds={initialHiddenStoreItemIds}
        marketRequests={marketRequests}
        initialWishlistEntries={initialWishlistEntries}
        creditsTotal={totalCredits}
        level={stats?.current_level ?? 0}
        marketInitialScrollSection={marketInitialScrollSection}
        onMarketInitialScrollDone={handleMarketInitialScrollDone}
        onMarketCreditsChanged={(credits) =>
          setStats((prev) => normalizeChildStatsCreditsSplit(mergeChildStatsPatch(prev, { credits })))
        }
        unlockedItemIndexes={initialUnlockedItemIndexes}
        praiseGrants={grants}
        praisePlacements={placements}
        serverPraiseBoardClearedAt={stats?.praise_board_cleared_at ?? null}
        onPraiseBoardCleared={clearPraiseStickerBoard}
        praiseGrantsRevision={praiseGrantsRevision}
        onInventoryChange={refreshStickerPlacements}
      />

      <PraiseGiftArrivalModal
        open={arrivalOpen}
        spriteKey={pendingArrivalGrant?.sprite_key ?? null}
        onGoStickers={openBearFromGift}
        onClose={dismissArrival}
      />

      {/* ── L6: 연속 탭 확인 팝업 ─────────────────────────────────────────── */}
      <MissionHonestyBlockedModal
        open={honestyModalOpen}
        reason={honestyBlockReason}
        onClose={() => {
          setHonestyModalOpen(false)
          setHonestyBlockReason(null)
        }}
      />

      <PlantStageCelebrationModal
        open={plantCelebrateStage !== null}
        stage={plantCelebrateStage}
        treeId={pot?.treeId ?? 'apple'}
        harvest={plantCelebrateStage === 7 ? plantHarvestCelebrate : null}
        onClose={dismissPlantCelebrate}
      />

      <RapidTapConfirmModal
        open={rapidTapModalOpen}
        onConfirm={handleRapidTapConfirm}
        onDeny={handleRapidTapDeny}
      />

      <ParentMissionRedoNoticeModal
        mission={parentRedoModalMission}
        onClose={() => setParentRedoModalMission(null)}
      />

      <PiggyBankUnlockFlowModal
        open={piggyUnlockFlowOpen}
        onClose={closePiggyUnlockFlow}
        onSkipTutorial={() => {
          piggyTutorialSkipRef.current = true
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(piggyTutorialSkipStorageKey(childId), '1')
          }
        }}
      />

      <StickerUnlockFlowModal
        open={stickerUnlockFlowOpen}
        onClose={closeStickerUnlockFlow}
        onSkipTutorial={() => {
          stickerTutorialSkipRef.current = true
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(stickerTutorialSkipStorageKey(childId), '1')
          }
        }}
      />

      <ContentZoneUnlockFlowModal
        open={contentZoneUnlockFlowOpen}
        onClose={() => setContentZoneUnlockFlowOpen(false)}
        onGoToMarketContent={openMarketToContent}
      />

      <DiaryModal
        open={isDiaryOpen}
        onClose={() => setIsDiaryOpen(false)}
        childId={childId}
        childProfile={diaryChildProfile}
        initialDate={diaryInitialDate}
        onInitialDateChange={setDiaryInitialDate}
      />

      {showSchoolTime && !isSleeping && !showMorningWake ? (
        <SchoolTimePopup
          childName={childName}
          soundSrc={resolveRoutineAlarmSoundUrl(readRoutineAlarmPrefs().soundSchool)}
          onClose={() => setShowSchoolTime(false)}
        />
      ) : showSleepReady && !isSleeping && !showMorningWake ? (
        <SleepReadyPopup
          childName={childName}
          soundSrc={resolveRoutineAlarmSoundUrl(readRoutineAlarmPrefs().soundSleepReady)}
          onGoMission={() => setShowSleepReady(false)}
          onClose={() => setShowSleepReady(false)}
        />
      ) : null}

      {showCelebration && (
        <AllMissionCompleteOverlay
          onSleep={() => {
            setShowCelebration(false)
            setIsSleeping(true)
            void fetch('/api/child/sleep-session-lock', { method: 'POST' }).catch(() => {})
          }}
        />
      )}

      {isSleeping && !showMorningWake ? (
        <SleepModeScreen
          childName={childName}
          alarmTime={routineWakeAlarmHHMM}
          onWake={() => {
            setIsSleeping(false)
            setShowMorningWake(true)
          }}
        />
      ) : null}

      {showMorningWake ? (
        <MorningWakeScreen childName={childName} onStart={() => setShowMorningWake(false)} />
      ) : null}

      {/*
       * z-[160] 이상인 ChildAlarmClockPopup — DOM 순서상 마지막에 두어도 자체 z-index로 최상위에 뜸
       * 비개발자 설명: 루틴 알람·뽀모도로(부모 LocalStorage 설정 반영)를 여는 중앙 팝업입니다.
       */}
      <ChildAlarmClockPopup open={clockPopupOpen} onClose={() => setClockPopupOpen(false)} />
      <ChildMusicPopup open={musicPopupOpen} onClose={() => setMusicPopupOpen(false)} />
      <ChildContentZonePopup
        open={contentZoneOpen}
        onClose={() => setContentZoneOpen(false)}
        childId={childId}
        channels={contentChannels}
        categories={contentCategories}
        level={stats?.current_level ?? 0}
        initialChestTicketQuantity={chestTicketQty}
        initialActiveSession={initialActiveContentSession}
        onOpenMarket={openMarketToContent}
        ticketBalanceUnavailable={ticketBalanceUnavailable}
        onChestTicketQuantityChange={handleChestTicketQuantityChange}
        onClawGrabPending={onClawGrabPending}
        onClawStatsSynced={onClawStatsSynced}
        onGoToMissions={() => {
          missionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }}
      />
    </>
  )
}
