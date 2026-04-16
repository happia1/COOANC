'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChildStats, PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'
import NavigationMapSheet from '@/components/child/NavigationMapSheet'
import BearStickerSheet from '@/components/child/BearStickerSheet'
import PraiseGiftArrivalModal from '@/components/child/PraiseGiftArrivalModal'
import ChildHomeIslandStage from '@/components/child/ChildHomeIslandStage'
import ChildHomeSceneryBand from '@/components/child/ChildHomeSceneryBand'
import { MapActionPill, StickerActionPill } from '@/components/child/ChildSceneryTopPills'
import { mergePraiseStickerGrantsFromServer } from '@/lib/mergePraiseStickerGrantsFromServer'
import { normalizeChildStatsCreditsSplit } from '@/lib/childCreditsSplit'
import {
  ASSETS,
  CHARACTER_DECOR_UI_FORCE_ALL_LOCKED,
  CHILD_HOME_BACKGROUND_CACHE_BUST,
} from '@/constants/assets'
import ItemUnlockCelebrationPopup from '@/components/child/ItemUnlockCelebrationPopup'
import type { TriggerKey } from '@/lib/gameLayer/triggerItemMap'

type Props = {
  childId: string
  initialStats: ChildStats | null
  childName: string
  /** 프로필에 고른 캐릭터 — 홈 섬 정면 스프라이트와 맞춥니다(없으면 토끼) */
  childAvatarUrl?: string | null
  /** @deprecated Phase 3에서 NavigationMapSheet로 교체됨. home/page.tsx에서 제거 예정. */
  growthMapData?: Record<string, unknown>
  initialPraiseGrants: PraiseStickerGrant[]
  initialPraisePlacements: PraiseStickerPlacement[]
  /** 이미 잠금 해제된 아이템 인덱스 목록 (서버에서 쿼리) */
  initialUnlockedItemIndexes?: number[]
  /** URL 파라미터 openNavMap=1 로 지도 자동 열기 */
  initialMapOpen?: boolean
}

/**
 * 아이 앱 홈 탭
 * - **한 화면**: 상단 풍경·하단 꾸미기가 **6:4** 비율(`flex-[6]`/`flex-[4]`)로 나뉨
 * - 섬 무대는 `ChildHomeIslandStage` 의 `density="flex"` 로 남는 세로 공간에 맞춤
 * - 배경: 홈 전용 큰 그림(`ASSETS.layouts.childHomeBackgroundSecondScreen` — 태블릿 키즈룸 세로 PNG)을 풀 블리드 셸 **뒤 한 겹**만 깝니다. CDN·브라우저 캐시는 `CHILD_HOME_BACKGROUND_CACHE_BUST` 로 `?v=` 끊고, **`next/image` 대신 `<img>`** 로 직접 요청해 최적화 캐시에 걸리지 않게 합니다. `ChildHomeSceneryBand` 는 캐릭터 무대만 담고 `showBackground={false}` 입니다. 옛 잔디·섬 합성 PNG는 `showIslandArt={false}` 로 끕니다.
 * - 칭찬 스티커(곰)는 무대 **오른쪽 상단**(기존 날씨 자리), 성장 지도는 무대 **왼쪽** 지도 단추로 엽니다.
 * - 부모가 칭찬 스티커를 내면 팝업 후 곰돌이 판에서 붙일 수 있음
 */
export default function HomeTab({
  childId,
  initialStats,
  childName,
  childAvatarUrl = null,
  growthMapData,
  initialPraiseGrants,
  initialPraisePlacements,
  initialUnlockedItemIndexes = [],
  initialMapOpen = false,
}: Props) {
  const [stats, setStats] = useState<ChildStats | null>(() =>
    initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null,
  )
  const [mapOpen, setMapOpen] = useState(initialMapOpen)
  const [unlockedItemIndexes, setUnlockedItemIndexes] = useState<number[]>(initialUnlockedItemIndexes)
  const [itemUnlockPopup, setItemUnlockPopup] = useState<{ index: number; triggerKey: TriggerKey } | null>(null)
  /**
   * 꾸미기 칸에 실제로 넘길「잠금 해제된 인덱스」입니다.
   * `CHARACTER_DECOR_UI_FORCE_ALL_LOCKED` 가 true 이면 DB 값과 관계없이 빈 배열이라 전부 잠금 UI가 됩니다.
   */
  const effectiveDecorUnlocked = CHARACTER_DECOR_UI_FORCE_ALL_LOCKED ? [] : unlockedItemIndexes
  const [bearOpen, setBearOpen] = useState(false)
  const [grants, setGrants] = useState(initialPraiseGrants)
  const [placements, setPlacements] = useState(initialPraisePlacements)
  /**
   * 20칸 완주 후 grants 가 통째로 사라질 때 BearStickerSheet 가 merge 로 옛 목록을 살리지 않게 합니다.
   * 숫자만 올리면 시트 안쪽 `initialGrants` 를 그대로 덮어씁니다.
   */
  const [praiseGrantsRevision, setPraiseGrantsRevision] = useState(0)
  const [arrivalOpen, setArrivalOpen] = useState(false)
  const [stickerFabImgOk, setStickerFabImgOk] = useState(true)
  /** 클라이언트 마운트 후에만 커스텀 FAB 이미지 사용 → SSR HTML 과 첫 페인트를 맞춤 */
  const [clientReady, setClientReady] = useState(false)

  useEffect(() => {
    setClientReady(true)
  }, [])

  useEffect(() => {
    setStats(initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null)
  }, [initialStats])

  useEffect(() => {
    setGrants((prev) => mergePraiseStickerGrantsFromServer(initialPraiseGrants, prev))
  }, [initialPraiseGrants])

  useEffect(() => {
    setPlacements(initialPraisePlacements)
  }, [initialPraisePlacements])

  /** 곰돌이 판에서 스티커만 붙였을 때: placements 만 다시 가져와서 도착 팝업용 grants 낙관적 상태를 덮어쓰지 않음 */
  const refreshStickerPlacementsOnly = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('praise_sticker_placements').select('*').eq('child_id', childId)
    if (data) setPlacements(data as PraiseStickerPlacement[])
  }, [childId])

  /** DB 의 발행 목록을 다시 읽습니다(다른 기기·서버에서 grants 가 통째로 삭제됐을 때 등) */
  const refreshGrantsOnly = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('praise_sticker_grants')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
    if (data) {
      setGrants(data as PraiseStickerGrant[])
      setPraiseGrantsRevision((r) => r + 1)
    }
  }, [childId])

  /**
   * 서버 reset-board 직후: placements 비움 + 가능하면 stats 에 판 비움 시각을 넣어
   * BearStickerSheet 가 닫혔다 열려도 서버와 같은 필터를 유지합니다.
   * 20칸 완주로 리셋된 경우(grantsDeleted) 발행 기록도 비우고 시트 merge 를 끊습니다.
   */
  const clearPraiseStickerBoard = useCallback((clearedAt?: string, meta?: { grantsDeleted?: boolean }) => {
    setPlacements([])
    if (meta?.grantsDeleted) {
      setGrants([])
      setPraiseGrantsRevision((r) => r + 1)
    }
    if (clearedAt) {
      setStats((prev) => (prev ? { ...prev, praise_board_cleared_at: clearedAt } : prev))
    }
  }, [])

  useEffect(() => {
    const pending = grants.some((x) => x.popup_dismissed_at == null)
    setArrivalOpen(pending)
  }, [grants])

  /**
   * 예전에는 Supabase Realtime(WebSocket)으로 칭찬·통계·잠금 해제를 즉시 받았습니다.
   * 자녀 앱 성능(홈 진입 시 긴 WS 핸드셰이크)을 줄이기 위해 구독을 제거했고,
   * 시트를 열거나 저장할 때 호출되는 `refreshGrantsOnly` 등 일반 쿼리로만 맞춥니다.
   */

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

  const openBearFromFab = useCallback(() => {
    setBearOpen(true)
  }, [])

  const openBearFromGift = useCallback(() => {
    setBearOpen(true)
    void dismissArrival()
  }, [dismissArrival])

  const sheets = (
    <>
      <NavigationMapSheet
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        childName={childName}
        stats={stats}
      />
      <BearStickerSheet
        open={bearOpen}
        onClose={() => setBearOpen(false)}
        childId={childId}
        initialGrants={grants}
        initialPlacements={placements}
        /** DB에 저장된 「마지막 판 비움」시각 — 새 탭에서도 예전 스티커가 종이에 안 쌓이게 함 */
        serverPraiseBoardClearedAt={stats?.praise_board_cleared_at ?? null}
        onInventoryChange={() => void refreshStickerPlacementsOnly()}
        onBoardCleared={clearPraiseStickerBoard}
        praiseGrantsRevision={praiseGrantsRevision}
      />
    </>
  )

  const arrivalModal = (
    <PraiseGiftArrivalModal open={arrivalOpen} onGoStickers={openBearFromGift} />
  )

  /**
   * 곰 스티커 단추를 무대 **오른쪽 상단**(기존 날씨 자리)으로 옮깁니다.
   * - 원형 배경 래퍼를 제거해 아이콘 자체만 보이게 합니다.
   * - 바깥은 `pointer-events-none`, 버튼만 `pointer-events-auto` 로 눌리게 유지합니다.
   * - `pt-5`/`sm:pt-6`: 아이콘을 한 단계 더 아래로(상단 여유).
   */
  const stickerTopRightButton = (
    <div className="pointer-events-none absolute right-0 top-0 z-20 pr-0.5 pt-5 sm:pr-1 sm:pt-6">
      <div className="pointer-events-auto shrink-0">
        <StickerActionPill
          useCustomImage={clientReady && stickerFabImgOk}
          onImageError={() => setStickerFabImgOk(false)}
          onClick={openBearFromFab}
        />
      </div>
    </div>
  )

  /**
   * 하단 꾸미기 영역: 위 풍경과 **6:4**(`flex-[6]` / `flex-[4]`).
   * `mt-5` / `sm:mt-6`: 섬·풍경과 간격을 넉넉히 두어 아이템 그리드 상단이 잘리거나 겹쳐 보이지 않게 합니다.
   * `pt-2`: 패널 안에서 제목·그리드가 위 경계에 붙지 않게 여유를 둡니다.
   */
  const homeBottomPanelClass =
    'relative z-10 mt-5 flex min-h-0 flex-[4] basis-0 flex-col gap-1 overflow-hidden px-3 pb-2 pt-0.5 sm:mt-6'

  /**
   * 홈 탭 전체(캐릭터 무대 + 「내 캐릭터 꾸미기」)를 `main` 패딩 밖까지 넓혀, 배경 PNG 가 좌우·상단에 닿게 합니다.
   * (미션 탭 `mission/layout.tsx` 와 같은 `calc(100%+2rem)` 원리 — 비개발자용: 화면 가장자리까지 그림이 이어집니다.)
   */
  const homeFullBleedShellClass =
    'relative isolate -mx-4 -mt-4 box-border flex min-h-0 min-w-0 w-[calc(100%+2rem)] max-w-none flex-1 shrink-0 flex-col self-stretch overflow-visible'

  /**
   * 홈 전체 뒤쪽 배경입니다.
   * (비개발자용) 아이가 보는 방 배경 그림이고, 버튼·캐릭터는 이 위 `z-[1]` 레이어에 있습니다.
   */
  /**
   * 배경 그림이 화면에서 살짝 위로 올라가 보이도록 기준점을 아래쪽(세로 58%)으로 둡니다.
   * - 비개발자용: 숫자를 50보다 크게 하면 그림이 위로, 작게 하면 아래로 움직인 것처럼 보입니다.
   */
  const homeBackgroundObjectPositionClass = 'object-cover object-[center_90%]'

  const homeTabFullBackground = (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      {/**
       * `next/image` 는 `/_next/image` 최적화 캐시 + 정적 `immutable` 헤더와 겹치면 배포 후에도 옛 WebP 가 남을 수 있어,
       * 풀블리드 배경은 원본 PNG URL + `?v=` 로 직접 불러옵니다.
       */}
      <img
        src={`${ASSETS.layouts.childHomeBackgroundSecondScreen}?v=${CHILD_HOME_BACKGROUND_CACHE_BUST}`}
        alt=""
        className={`absolute inset-0 h-full w-full ${homeBackgroundObjectPositionClass}`}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        draggable={false}
      />
    </div>
  )

  if (!stats) {
    return (
      <>
        <div className={homeFullBleedShellClass}>
          {homeTabFullBackground}
          {/** 통계가 없을 때도 홈 전용 배경은 동일하게 깔고, 콘텐츠만 이 래퍼 위에 올립니다. */}
          <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
            <ChildHomeSceneryBand edgeBleed={false} flexFill showBackground={false} ariaLabel="홈 상단">
              <div className="shrink-0 space-y-2 py-1 text-center">
                <p className="text-sm text-gray-500">부모님이 미션을 만들어주실 거야.</p>
              </div>
              {/** `flex-1 min-h-0`: 풍경 밴드 안에서 섬이 남는 높이를 쓰고, 작은 화면에서도 잘리지 않게 줄어듦 */}
              <div className="flex min-h-0 flex-1 flex-col justify-end">
                {/**
                 * 성장 지도 단추만 무대 **왼쪽** 세로 가운데 — 곰 스티커는 화면 오른쪽 아래 플로팅으로 옮겼습니다.
                 * `pointer-events-none` 으로 빈 곳 탭은 통과하고 지도 단추만 눌리게 합니다.
                 */}
                {/**
                 * 섬·잔디·캐릭터 묶음: `-mt` 를 더 줄여 한 칸 더 아래로 보이게(곰 단추와 맞춤).
                 */}
                <div className="relative mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col items-center justify-end -mt-2 sm:-mt-4">
                  {/**
                   * 성장 지도(지도 아이콘) 단추 위치
                   * - 요청사항: "왼쪽 상단" 배치
                   * - `pointer-events-none` 으로 빈 영역 탭은 통과시키고, 버튼만 `pointer-events-auto` 로 눌리게 합니다.
                   * - `pt-5`/`sm:pt-6`: 곰 스티커 단추와 같은 높이감으로 맞춤
                   */}
                  <div className="pointer-events-none absolute left-0 top-0 z-20 flex items-start pl-0.5 pt-5 sm:pl-1 sm:pt-6">
                    <div className="pointer-events-auto shrink-0">
                      <MapActionPill onClick={() => setMapOpen(true)} />
                    </div>
                  </div>
                  {/** 기존 날씨 위치에 곰 스티커 단추를 배치합니다. */}
                  {stickerTopRightButton}
                  <ChildHomeIslandStage density="flex" homeAvatarUrl={childAvatarUrl} showIslandArt={false} />
                </div>
              </div>
            </ChildHomeSceneryBand>
            <section className={homeBottomPanelClass} aria-label="내 캐릭터 꾸미기">
              <CharacterDecorInventory unlockedIndexes={effectiveDecorUnlocked} />
            </section>
          </div>
        </div>
        {sheets}
        {arrivalModal}
        {itemUnlockPopup && (
          <ItemUnlockCelebrationPopup
            itemIndex={itemUnlockPopup.index}
            triggerKey={itemUnlockPopup.triggerKey}
            onClose={() => setItemUnlockPopup(null)}
          />
        )}
      </>
    )
  }

  return (
    <div className={homeFullBleedShellClass}>
      {homeTabFullBackground}
      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
        <ChildHomeSceneryBand edgeBleed={false} flexFill flexFillWeight={5.5} showBackground={false} ariaLabel="홈 상단">
          {/** 캐릭터 무대: `-mt` 로 하단 꾸미기와 살짝만 겹칩니다. 배경은 셸의 `homeTabFullBackground` 가 담당합니다. */}
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5">
            <div className="relative mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col items-center justify-end -mt-2 sm:-mt-4">
              {/**
               * 성장 지도(지도 아이콘) 단추 위치
               * - 요청사항: "왼쪽 상단" 배치
               * - 로딩/정상 화면에서 동일한 좌표를 사용해 UX 를 일관되게 합니다.
               * - `pt-5`/`sm:pt-6`: 우측 곰 스티커 단추와 세로 위치를 맞춤
               */}
              <div className="pointer-events-none absolute left-0 top-0 z-20 flex items-start pl-0.5 pt-5 sm:pl-1 sm:pt-6">
                <div className="pointer-events-auto shrink-0">
                  <MapActionPill onClick={() => setMapOpen(true)} />
                </div>
              </div>
              {/** 기존 날씨 위치(우상단)에 곰 스티커 단추를 동일하게 배치합니다. */}
              {stickerTopRightButton}
              <ChildHomeIslandStage density="flex" homeAvatarUrl={childAvatarUrl} showIslandArt={false} />
            </div>
          </div>
        </ChildHomeSceneryBand>

        <section className={homeBottomPanelClass} aria-label="내 캐릭터 꾸미기">
          <CharacterDecorInventory unlockedIndexes={effectiveDecorUnlocked} />
        </section>
      </div>

      {sheets}
      {arrivalModal}
      {itemUnlockPopup && (
        <ItemUnlockCelebrationPopup
          itemIndex={itemUnlockPopup.index}
          triggerKey={itemUnlockPopup.triggerKey}
          onClose={() => setItemUnlockPopup(null)}
        />
      )}
    </div>
  )
}

/** 꾸미기 썸네일 개수·열 개수 — `ASSETS.characters.decorItemImages` 와 길이가 같아야 합니다. */
const DECOR_ITEM_COUNT = ASSETS.characters.decorItemImages.length

/** 위·아래 두 줄이면 열 개수는 아이템 수의 절반입니다. */
const DECOR_GRID_COLS = DECOR_ITEM_COUNT / 2

/**
 * 잠금된 칸 가운데에만 겹쳐 보일 자물쇠 SVG 입니다(별도 아이콘 패키지 없이 가볍게 그립니다).
 * 선 색은 `currentColor` 이므로 부모에서 `text-white` 등으로 **흰 자물쇠**를 줄 수 있습니다.
 * `aria-hidden`: 스크린 리더는 바깥 `aria-label` 로만 설명하고 이 그림은 장식으로 취급합니다.
 */
function DecorLockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M7 11V8a5 5 0 0110 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="4" y="11" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="16" r="1.25" fill="currentColor" />
    </svg>
  )
}

/**
 * 꾸미기 인벤토리 — 아이템을 **위·아래 2줄**로 두고, **한 번의 가로 스크롤**로 두 줄이 같이 밀립니다.
 * 잠금 해제된 아이템은 컬러로, 그 외는 흑백 썸네일 위에 **흰색 자물쇠**만 가운데 겹칩니다(별도 막·「잠금」글자 없음).
 */
function CharacterDecorInventory({ unlockedIndexes }: { unlockedIndexes: number[] }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col" aria-labelledby="child-decor-heading">
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 pl-2 pr-2 pb-0.5 pt-0.5">
        <h2 id="child-decor-heading" className="min-w-0 truncate text-sm font-black leading-tight text-brand-text">
          내 캐릭터 꾸미기
        </h2>
      </div>
      <div
        className="-mx-1 min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-2 pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
        role="region"
        aria-label="캐릭터 꾸미기 아이템 목록, 위아래 두 줄"
      >
        <div className="flex h-full min-h-0 w-max items-start gap-1.5 pt-0.5 pr-1">
          {Array.from({ length: DECOR_GRID_COLS }).map((_, col) => (
            <div
              key={`decor-col-${col}`}
              role="group"
              aria-label={`꾸미기 아이템 ${col * 2 + 1}번·${col * 2 + 2}번`}
              className="grid w-[min(18vw,76px)] shrink-0 snap-center grid-rows-2 gap-y-1"
            >
              {[0, 1].map((rowInCol) => {
                const index = col * 2 + rowInCol
                const unlocked = unlockedIndexes.includes(index)
                return (
                  <div
                    key={`decor-item-${index}`}
                    aria-disabled={!unlocked}
                    aria-label={`꾸미기 아이템 ${index + 1}번${unlocked ? ', 잠금 해제됨' : ', 잠금됨'}`}
                    className="pointer-events-none aspect-square w-full"
                  >
                    <div className="relative size-full overflow-hidden rounded-xl border border-amber-100/90 bg-[#f7f4eb] shadow-sm">
                      {/**
                       * 잠김/해제와 관계없이 기존처럼 실제 아이템 이미지를 항상 그립니다.
                       * 잠긴 칸은 아래 클래스에서 흑백+투명도만 적용해 "보이되 비활성" 상태를 유지합니다.
                       */
                      }
                      <Image
                        src={ASSETS.characters.decorItemImages[index]}
                        alt=""
                        fill
                        loading="lazy"
                        sizes="(max-width: 448px) 18vw, 76px"
                        className={`object-contain p-0.5 transition-all duration-500 ${unlocked ? '' : 'grayscale opacity-[0.55]'}`}
                        draggable={false}
                      />
                      {!unlocked && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          {/** 가운데 흰 자물쇠만 — 밝은 썸네일에서도 보이도록 살짝 어두운 외곽 그림자 */}
                          <DecorLockIcon className="size-[28%] min-h-[22px] min-w-[22px] max-h-9 max-w-9 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

