'use client'

/**
 * ChildScreen — 자녀 앱 단일 화면
 *
 * 3탭(홈·미션·마켓)을 하나의 풀스크린 화면으로 통합합니다.
 *
 * 비개발자 설명:
 * - 배경 이미지 위에 캐릭터가 서 있고, 하단에 오늘의 미션 카드가 가로로 스크롤됩니다.
 * - 우측 상단 스택(나가기·스티커·장바구니·코인)은 화면이 넓어질수록 문·스티커·장바구니는 최대 1.8배까지 커집니다. 마켓 패널은 아래에서 올라옵니다.
 * - 상단 오른쪽 나가기(유리 버튼)를 누르면 부모 화면으로 나갑니다.
 * - 새로고침은 레벨·크레딧 유리 카드 **안 오른쪽 아래** 아주 연한 회색 아이콘으로만 둡니다(전체 페이지를 다시 불러 꼬임을 풀 때 씁니다).
 * - 뽀모도로(왼쪽)·음악(오른쪽)은 레벨 블록 바로 아래 한 줄에 배치합니다.
 * - 발 옆: **저금통**은 예전 화분 자리(`plantPct`), **화분**은 예전 물조리개 자리(`canPct`) — 간격은 과거 화분·물조리개 간격과 동일 규칙입니다.
 * - 물조리개는 화분 팝업 안으로 들어 갔습니다.
 * 레이아웃 레이어(아래 → 위):
 *   L1. 배경 이미지 (tablet_kidsroom_background_portrait.png)
 *   L2. 캐릭터 스프라이트 (앵커포인트 기반 배치)
 *   L3. UI 오버레이 (상단: 레벨 카드·카드 안 새로고침·크레딧·하트, 발 옆 저금통·화분, 우측 나가기~장바구니·코인 열 + 미션 섹션)
 *   L4. 패널 오버레이 (마켓: 항상 하단 슬라이드 / 코인·꾸미기: 세로는 하단·가로는 우측 / 스티커는 별도 시트)
 */

import { Fragment, useRef, useState, useCallback, useMemo, useEffect, memo } from 'react'
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
import { getUnlockedFeatures } from '@/constants/childScreenFeatures'
import { usePlantPot } from '@/hooks/usePlantPot'
import { useContainerSize } from '@/hooks/useContainerSize'
import ChildMissionCard from '@/components/child/ChildMissionCard'
import ChildPanelOverlay, { type PanelType } from '@/components/child/ChildPanelOverlay'
import ChildLevelStatsCard from '@/components/child/ChildLevelStatsCard'
import ChildHomePiggyBank from '@/components/child/ChildHomePiggyBank'
import { normalizeChildStatsCreditsSplit, mergeChildStatsPatch, readChildStatInt } from '@/lib/childCreditsSplit'
import { usesSingleBucket } from '@/constants/childAgeConfig'
import { completionRateToHearts } from '@/lib/missionHeartCount'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'
import { isSpecialSectionMission, isRetiredSpecialMissionTitle } from '@/lib/specialMissionChips'
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
import type { PlantStage } from '@/constants/plantTrees'
import type {
  ChildStats,
  DailyMissionWithTemplate,
  StoreItem,
  PurchaseRequest,
  PraiseStickerGrant,
  PraiseStickerPlacement,
} from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { fireMissionCardConfetti } from '@/lib/missionCardConfetti'
import { tryApplyCompletePayload } from '@/lib/applyDailyMissionCompleteStats'
import AllMissionCompleteOverlay from '@/components/child/AllMissionCompleteOverlay'
import ChildAlarmClockPopup from '@/components/child/ChildAlarmClockPopup'
import ChildMusicPopup from '@/components/child/ChildMusicPopup'
import PlantPot from '@/components/child/PlantPot'
import SeedSelectModal from '@/components/child/SeedSelectModal'
import PlantStageCelebrationModal from '@/components/child/PlantStageCelebrationModal'
import SleepModeScreen from '@/components/child/SleepModeScreen'
import MorningWakeScreen from '@/components/child/MorningWakeScreen'
import SleepReadyPopup from '@/components/child/SleepReadyPopup'
import SchoolTimePopup from '@/components/child/SchoolTimePopup'
import { readRoutineAlarmPrefs } from '@/lib/routineAlarmLocalPrefs'
import { resolveRoutineAlarmSoundUrl } from '@/lib/routineAlarmSounds'
import { installChildRoutineAudioUnlockOnFirstGesture } from '@/lib/childAudio'
import { toYyyyMmDdDbValue, dbValueMeansIncomplete, getSeoulTimeHHMM, getSeoulWeekdayShort } from '@/lib/koreaDate'
import { isAfternoonMission } from '@/lib/missionAmPm'
import {
  isBedtimeMissionBlockedBeforeSleepReadyWindow,
  isSeoulTimeBeforeNoon,
} from '@/lib/missionHonestyTiming'

/** 화분 단계 상승(물주기로 stage+1) 시 재생할 효과음 */
const PLANT_STAGE_UP_SOUND_SRC =
  '/assets/audio/missions/get_badge-christmas-reveal-tones-2988.wav' as const

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

/** 문·뽀모도로·스티커·장바구니 네 버튼 — 레벨 카드와 같은 가로 구간에서 선형 확대, 최대 1.8배 */
const RIGHT_ICON_PRIMARY_SCALE_BASE_W = LEVEL_BLOCK_SCALE_BASE_W
const RIGHT_ICON_PRIMARY_SCALE_FULL_W = LEVEL_BLOCK_SCALE_FULL_W
const RIGHT_ICON_PRIMARY_SCALE_MAX = 1.8

/** 코인(💰)만 별도 — 같은 구간식이지만 최대 1.3배까지만(기존 상한 유지) */
const RIGHT_ICON_COIN_SCALE_BASE_W = LEVEL_BLOCK_SCALE_BASE_W
const RIGHT_ICON_COIN_SCALE_FULL_W = LEVEL_BLOCK_SCALE_FULL_W
const RIGHT_ICON_COIN_SCALE_MAX = 1.3

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

/** 화분·물조리개(발 옆) — 모바일에서 최대 1.5배까지 확대 */
const PLANT_FEET_UI_SCALE_MAX = 1.5

/**
 * 발 옆 화분·물조리개의 **표시 크기**와 **토끼와의 가로 간격(px)** 을 맞출 때 쓰는 기준 가로(px).
 * 비개발자: 가로 885일 때 화분·물조리개 크기(배율)와, 토끼 발치 기준 가로 간격을 그대로 유지합니다.
 */
const PLANT_FEET_LAYOUT_REFERENCE_W = 885
/** 데스크톱/태블릿에서 화분·물조리개를 토끼 기준으로 벌리는 배율(1=기존, 1.35=35% 더 멀게) */
const PLANT_FEET_GAP_SPREAD_MULTIPLIER = 1.35
/** 아주 좁은 화면(<640px)에서 발 옆 간격 배율 — 낮출수록 토끼 양옆으로 더 붙습니다. 640px 이상은 데스크톱 배율을 씁니다(예: 760px 창에서 저금통·화분이 넓게). */
const PLANT_FEET_GAP_SPREAD_MULTIPLIER_MOBILE = 1.07
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

/** 나가기·타이머·스티커·마켓 바구니 — 넓은 화면에서 최대 1.8배 */
function scaleForRightIconPrimary(containerWidthPx: number): number {
  /**
   * 요청사항:
   * - 최소 아이콘 크기를 기존 1배에서 1.2배로 올립니다.
   * - 최대값(1.8배)은 유지합니다.
   */
  const base = 1.2
  if (!(containerWidthPx > 0)) return base
  const span = RIGHT_ICON_PRIMARY_SCALE_FULL_W - RIGHT_ICON_PRIMARY_SCALE_BASE_W
  if (span <= 0) return base
  if (containerWidthPx <= RIGHT_ICON_PRIMARY_SCALE_BASE_W) return base
  if (containerWidthPx >= RIGHT_ICON_PRIMARY_SCALE_FULL_W) return RIGHT_ICON_PRIMARY_SCALE_MAX
  const t = (containerWidthPx - RIGHT_ICON_PRIMARY_SCALE_BASE_W) / span
  return base + t * (RIGHT_ICON_PRIMARY_SCALE_MAX - base)
}

/** 코인 버튼만 — 최대 1.3배 */
function scaleForRightIconCoin(containerWidthPx: number): number {
  return scaleFromContainerWidth(
    containerWidthPx,
    RIGHT_ICON_COIN_SCALE_BASE_W,
    RIGHT_ICON_COIN_SCALE_FULL_W,
    RIGHT_ICON_COIN_SCALE_MAX,
  )
}

/**
 * 우측 상단 나가기·타이머·스티커·장바구니(·코인) 버튼 셸 — 왼쪽 레벨 카드와 같은 유리 톤.
 * 비개발자: 레벨 블록과 똑같이 살짝 비치는 흰 배경, 흐림, 둥근 모서리로 맞춥니다.
 * 안 그림(문·타이머·스티커·바구니)은 같은 기본 크기(h-6/h-7)·화면이 넓으면 묶음 단위로 최대 1.8배까지 커집니다.
 */
const CHILD_HOME_RIGHT_ICON_GLASS_CLASS = [
  CHILD_HOME_TOP_BAR_GLASS_CLASS,
  'flex h-10 w-10 shrink-0 items-center justify-center',
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

  /** 같은 키워드·중복 일일행이 있으면 가로 슬라이더에는 한 장만 남깁니다 */
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
  /** Mission Complete 하트 5칸 ref — **애정 하트(미션 보상)** 파티클 목적지 */
  const levelHeartsRef = useRef<HTMLDivElement>(null)
  /** 현재 화면에 떠 있는 파티클 목록 */
  const [particles, setParticles] = useState<Particle[]>([])

  /** 크레딧 배지 반짝임 활성화 여부 */
  const [badgeShine, setBadgeShine] = useState(false)

  const router = useRouter()

  /**
   * 레벨 카드 오른쪽 아래 새로고침에서 호출합니다.
   * - `router.refresh()`만 쓰면 서버에서 내려준 props는 갱신되지만, 이 화면 안의 `useState` 등은 그대로일 수 있습니다.
   * - 그래서 꼬임·버그를 풀 때는 브라우저 전체 새로고침과 같은 `location.reload()`로 한 번에 맞춥니다.
   */
  const handleChildHomeRefresh = useCallback(() => {
    window.location.reload()
  }, [])

  // ── 통계(크레딧/하트) ──────────────────────────────────────────────────────

  const [stats, setStats] = useState<ChildStats | null>(() =>
    initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null,
  )

  /** 화분(식물) — `child_stats`의 pot_* 컬럼과 동기화 */
  const { pot, hearts: plantHearts, loading: plantLoading, water, resetPot } = usePlantPot(childId)
  /** 완성 후 씨앗 고르기 모달 */
  const [seedModalOpen, setSeedModalOpen] = useState(false)
  /** 성장 단계 축하 팝업 — 도달한 단계 번호(null 이메 닫힘) */
  const [plantCelebrateStage, setPlantCelebrateStage] = useState<PlantStage | null>(null)
  /** 7단계 축하 팝업을 닫은 뒤에만 씨앗 선택 시트를 열지 표시 */
  const openSeedAfterPlantCelebrateRef = useRef(false)
  /** 하트가 0일 때 물주기 시 잠깐 뜨는 안내 */
  const [plantHint, setPlantHint] = useState<string | null>(null)

  const openSeedModal = useCallback(() => setSeedModalOpen(true), [])

  const handlePlantGrowthCelebrate = useCallback((newStage: PlantStage) => {
    // 화분이 실제로 한 단계 올라간 시점에만 단계업 효과음을 재생합니다.
    playUiSound(PLANT_STAGE_UP_SOUND_SRC, 0.9)
    setPlantCelebrateStage(newStage)
    if (newStage === 7) openSeedAfterPlantCelebrateRef.current = true
  }, [playUiSound])

  const dismissPlantCelebrate = useCallback(() => {
    setPlantCelebrateStage(null)
    const needSeed = openSeedAfterPlantCelebrateRef.current
    openSeedAfterPlantCelebrateRef.current = false
    if (needSeed) openSeedModal()
  }, [openSeedModal])

  /** 물줄 때 숫자는 상단 스탯과 맞추되, 스탯보다 훅이 먼저 갱신될 때를 대비해 둘 중 있는 값 사용 */
  const waterButtonHearts = stats?.hearts ?? plantHearts

  useEffect(() => {
    if (!plantHint) return
    const id = window.setTimeout(() => setPlantHint(null), 2200)
    return () => clearTimeout(id)
  }, [plantHint])

  useEffect(() => {
    setStats(initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null)
  }, [initialStats])

  const handleStatsUpdate = useCallback(
    (patch: { credits: number; credits_wallet: number; credits_piggy: number }) => {
      setStats((prev) => normalizeChildStatsCreditsSplit(mergeChildStatsPatch(prev, patch)))
    },
    [],
  )

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
          seoulDateYmd: today,
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
      today,
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
   * 뽀모도로·알람 팝업(ChildAlarmClockPopup) 열림 여부
   * 비개발자 설명: 상단 우측 타이머(유리 버튼)를 누르면 true 가 되고, 닫기로 false 가 됩니다.
   */
  const [clockPopupOpen, setClockPopupOpen] = useState(false)
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
  }, [dailyMissions, today])

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
  }, [today])

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
      if (rowDate !== today) return
      if (!dbValueMeansIncomplete(row.is_completed)) return
      const dmId = String(row.id ?? '')
      if (!dmId) return
      applyRollbackByDailyMissionId(dmId)
    }

    function onMissionLogRemoteUpdate(payload: { new: Record<string, unknown> }) {
      const row = payload.new
      const ad = toYyyyMmDdDbValue(row.assigned_date)
      if (ad !== today) return
      if (!dbValueMeansIncomplete(row.is_completed)) return
      const templateId = String(row.mission_id ?? '')
      if (!templateId) return

      setMissionList((prevList) => {
        const snapshot = prevList.find(
          (m) => m.mission_template_id === templateId && toYyyyMmDdDbValue(m.date) === today,
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
          setStats((prev) =>
            normalizeChildStatsCreditsSplit(mergeChildStatsPatch(prev, payload.new as Record<string, unknown>)),
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(broadcastChannel)
      void supabase.removeChannel(dmChannel)
      void supabase.removeChannel(mlChannel)
      void supabase.removeChannel(statsChannel)
    }
  }, [childId, today])

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
      const isWeekend = ['토', '일'].includes(getSeoulWeekdayShort(today))

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
    today,
  ])

  /** 자정 자동 새로고침 */
  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
    const ms = midnight.getTime() - now.getTime()
    const timer = setTimeout(() => router.refresh(), ms)
    return () => clearTimeout(timer)
  }, [router])

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
        if (isRetiredSpecialMissionTitle(m.title)) return false
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

      setTimeout(() => {
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
      }, 220)

      void (async () => {
        try {
          const res = await fetch('/api/daily-mission/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dailyMissionId: dm.id, today, childId }),
          })
          const text = await res.text()
          let json: unknown = {}
          try {
            json = text ? JSON.parse(text) : {}
          } catch {
            /* 응답이 JSON이 아니면 stats 동기화 생략 */
          }
          if (res.ok) {
            setStats((prev) => tryApplyCompletePayload(prev, json) ?? prev)
          } else {
            optimisticDailyMissionCompleteIdsRef.current.delete(dm.id)
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
      })()
    },
    [today, childId, triggerBadgeShine, visibleMissions],
  )

  const handleMissionComplete = useCallback(
    (
      dm: DailyMissionWithTemplate,
      cardRect: DOMRect,
      creditReward: number,
      heartReward: number,
    ) => {
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
    [done, commitMissionComplete, getHonestyBlockForMission],
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

  // ── 패널 상태 ──────────────────────────────────────────────────────────────

  const [activePanel, setActivePanel] = useState<PanelType>(null)

  // ── 기능 해금 ─────────────────────────────────────────────────────────────

  const features = useMemo(
    () => getUnlockedFeatures(stats?.current_level ?? 0, ageYears),
    [stats?.current_level, ageYears],
  )

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

  /** 상단 우측: 문·타이머·스티커·장바구니 묶음 — 최대 1.8배 / 코인은 별도 1.3배 상한 */
  const rightIconPrimaryScale = useMemo(() => scaleForRightIconPrimary(containerW), [containerW])
  const rightIconCoinScale = useMemo(() => scaleForRightIconCoin(containerW), [containerW])

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

  /** 레벨·나이 기준으로 지갑/저금통 분리(멀티 버킷) 여부 — 단일 버킷이면 저금 API 를 막습니다. */
  const multiBucketMode = useMemo(
    () => !usesSingleBucket(stats?.current_level ?? 0, ageYears),
    [stats?.current_level, ageYears],
  )

  /** 저금통 팝업에서 지갑·저금 잔액만 반영합니다. */
  const patchWalletPiggyFromHome = useCallback((p: { credits_wallet: number; credits_piggy: number }) => {
    setStats((prev) => (prev ? mergeChildStatsPatch(prev, p) : prev))
  }, [])

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
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: `${anchor.rugCenterX * 100}%`,
              top: `${anchor.characterFootY * 100}%`,
              /** translate(-50%, -100%): 캐릭터 발 중심을 앵커에 정확히 맞춥니다 */
              transform: 'translate(-50%, -100%)',
            }}
          >
            <CharacterSprite
              character={characterSprite.character}
              frame={characterSprite.frame}
              width={Math.round(characterDisplayH * (characterSprite.width / characterSprite.height))}
              height={characterDisplayH}
              className="select-none"
              style={
                characterSprite.character === 'chicks'
                  ? { clipPath: `inset(0 0 0 ${CHICK_HOME_ISLAND_CLIP_LEFT_PX}px)` }
                  : undefined
              }
            />
          </div>
        )}

        {/* ── L3: UI 오버레이 ──────────────────────────────────────────────── */}
        <div className="absolute inset-0 z-20 flex flex-col pointer-events-none">

          {/*
            상단: 왼쪽 레벨 카드(카드 아래: 뽀모도로·음악) / 발 옆 저금통·화분 / 우측 나가기·스티커…
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
                      heartsCount={waterButtonHearts}
                      onRefresh={handleChildHomeRefresh}
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
                    {/*
                      화분 로딩 전·실패 시: 카드 아래에 저금통만 잠깐 둡니다(발 옆 자리로 옮기기 전).
                    */}
                    {stats && (plantLoading || !pot) ? (
                      <div className="pointer-events-auto mt-6 flex w-max max-w-full justify-start">
                        <ChildHomePiggyBank
                          walletCredits={readChildStatInt(stats.credits_wallet)}
                          piggyCredits={readChildStatInt(stats.credits_piggy)}
                          childId={childId}
                          multiBucket={multiBucketMode}
                          onWalletPiggyUpdate={patchWalletPiggyFromHome}
                        />
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
              {badgeShine && creditBadgeRef.current ? (
                <BadgeStarBurst badgeRef={creditBadgeRef} />
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-3 pointer-events-auto">
              {/*
                문·스티커·장바구니를 한 묶음으로 스케일 — 레벨 카드와 같은 가로폭 규칙으로 최대 1.8배.
              */}
              <div
                className="flex flex-col items-end gap-3"
                style={{
                  transformOrigin: 'top right',
                  transform: `scale(${rightIconPrimaryScale})`,
                }}
              >
                <a
                  href={exitHref}
                  className={`${CHILD_HOME_RIGHT_ICON_GLASS_CLASS} no-underline transition active:scale-95`}
                  style={CHILD_HOME_TOP_BAR_GLASS_STYLE}
                  aria-label="나가기"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/img/common/ui/exit.png"
                    alt=""
                    width={24}
                    height={24}
                    // 버튼 블록은 고정하고, 나가기 문 아이콘 그림만 오른쪽으로 아주 미세하게 이동합니다.
                    className="h-6 w-6 translate-x-[1px] object-contain drop-shadow-md"
                  />
                </a>
                {features.sticker && (
                  <button
                    type="button"
                    onClick={() => setActivePanel('sticker')}
                    className={`${CHILD_HOME_RIGHT_ICON_GLASS_CLASS} border-0 bg-transparent p-0 transition active:scale-95`}
                    style={CHILD_HOME_TOP_BAR_GLASS_STYLE}
                    aria-label="칭찬 스티커 판 열기"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/assets/img/common/ui/luckybox.png"
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain drop-shadow-md"
                    />
                  </button>
                )}
                {features.market && (
                  <button
                    type="button"
                    onClick={() => setActivePanel('market')}
                    className={`${CHILD_HOME_RIGHT_ICON_GLASS_CLASS} border-0 bg-transparent p-0 transition active:scale-95`}
                    style={CHILD_HOME_TOP_BAR_GLASS_STYLE}
                    aria-label="마켓 열기"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/assets/img/common/ui/basket_filled.png"
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain drop-shadow-md"
                    />
                  </button>
                )}
              </div>
              {features.coinPocket && (
                <div
                  style={{
                    transformOrigin: 'top right',
                    transform: `scale(${rightIconCoinScale})`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActivePanel('coins')}
                    className={`${CHILD_HOME_RIGHT_ICON_GLASS_CLASS} border-0 bg-transparent p-0 transition active:scale-95`}
                    style={CHILD_HOME_TOP_BAR_GLASS_STYLE}
                    aria-label="내 크레딧 열기"
                  >
                    <span className="text-lg leading-none" role="img" aria-hidden>
                      💰
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/*
            발 옆 — 저금통(`plantPct`), 화분(`canPct`). 간격은 과거 화분·물조리개와 같은 앵커 쌍입니다.
            물조리개는 화분 팝업 안에서만 사용합니다.
          */}
          {!plantLoading && pot && stats ? (
            <>
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
                    walletCredits={readChildStatInt(stats.credits_wallet)}
                    piggyCredits={readChildStatInt(stats.credits_piggy)}
                    childId={childId}
                    multiBucket={multiBucketMode}
                    onWalletPiggyUpdate={patchWalletPiggyFromHome}
                  />
                </div>
              </div>
              <div
                className="pointer-events-auto absolute z-[21]"
                style={{
                  left: `${plantFeetAnchorsPct.canPct + piggyPotExtraSpreadPct}%`,
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
                  <PlantPot
                    pot={pot}
                    onRequestSeedSelect={openSeedModal}
                    waterActions={{
                      hearts: waterButtonHearts,
                      water,
                      onNoHearts: () =>
                        setPlantHint('하트가 부족해요! 미션을 하면 하트를 받을 수 있어요.'),
                      onGrowthCelebrate: handlePlantGrowthCelebrate,
                    }}
                  />
                </div>
              </div>
            </>
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
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-5 min-[400px]:px-6">
              <p className="min-w-0 text-[clamp(0.875rem,calc(0.8rem+0.2vw),1.125rem)] font-black text-white drop-shadow">
                오늘의 미션
              </p>
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
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-5 text-center">
                  <p className="font-bold text-gray-600 text-sm">아직 미션이 없어요</p>
                  <p className="text-xs text-gray-400 mt-1">부모님이 미션을 만들어주실 거예요!</p>
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

                  return (
                    <Fragment key={mission.id}>
                      {showMorningAfternoonDivider ? (
                        <div
                          role="separator"
                          aria-hidden
                          className="pointer-events-none shrink-0 self-stretch w-px min-h-[5rem] bg-white/45 shadow-[1px_0_0_rgba(0,0,0,0.08)] mx-[clamp(2px,calc(0.25rem+0.2vw),6px)]"
                        />
                      ) : null}
                      <ChildMissionCard
                        mission={mission}
                        tapResetKey={missionTapUnblock[mission.id] ?? 0}
                        onComplete={handleMissionComplete}
                      />
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
        onClose={() => setActivePanel(null)}
        childId={childId}
        features={features}
        marketEligibleItems={marketEligibleItems}
        initialHiddenStoreItemIds={initialHiddenStoreItemIds}
        marketRequests={marketRequests}
        initialWishlistEntries={initialWishlistEntries}
        creditsWallet={stats?.credits_wallet ?? 0}
        creditsTotal={totalCredits}
        level={stats?.current_level ?? 0}
        ageYears={ageYears}
        childStats={stats}
        onStatsUpdate={handleStatsUpdate}
        unlockedItemIndexes={initialUnlockedItemIndexes}
        praiseGrants={grants}
        praisePlacements={placements}
        serverPraiseBoardClearedAt={stats?.praise_board_cleared_at ?? null}
        onPraiseBoardCleared={clearPraiseStickerBoard}
        praiseGrantsRevision={praiseGrantsRevision}
        onInventoryChange={refreshStickerPlacements}
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

      <PlantStageCelebrationModal open={plantCelebrateStage !== null} stage={plantCelebrateStage} onClose={dismissPlantCelebrate} />

      <RapidTapConfirmModal
        open={rapidTapModalOpen}
        onConfirm={handleRapidTapConfirm}
        onDeny={handleRapidTapDeny}
      />

      <ParentMissionRedoNoticeModal
        mission={parentRedoModalMission}
        onClose={() => setParentRedoModalMission(null)}
      />

      <SeedSelectModal
        open={seedModalOpen}
        onClose={() => setSeedModalOpen(false)}
        onConfirm={async (treeId) => {
          await resetPot(treeId)
        }}
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
    </>
  )
}
