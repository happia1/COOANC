'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChildStats, PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'
import GrowthMapSheet, { type GrowthMapSheetData } from '@/components/child/GrowthMapSheet'
import BearStickerSheet from '@/components/child/BearStickerSheet'
import PraiseGiftArrivalModal from '@/components/child/PraiseGiftArrivalModal'
import ChildHomeIslandStage from '@/components/child/ChildHomeIslandStage'
import ChildHomeSceneryBand from '@/components/child/ChildHomeSceneryBand'
import { MapActionPill, StickerActionPill } from '@/components/child/ChildSceneryTopPills'
import TodayWeatherBadge from '@/components/child/TodayWeatherBadge'
import { mergePraiseStickerGrantsFromServer } from '@/lib/mergePraiseStickerGrantsFromServer'
import { mergeChildStatsPatch, normalizeChildStatsCreditsSplit } from '@/lib/childCreditsSplit'

type Props = {
  childId: string
  initialStats: ChildStats | null
  childName: string
  /** 지도 시트 안의 뱃지 컬렉션용(전체 뱃지 + 획득 맵) */
  growthMapData: GrowthMapSheetData
  initialPraiseGrants: PraiseStickerGrant[]
  initialPraisePlacements: PraiseStickerPlacement[]
}

/**
 * 아이 앱 홈 탭
 * - **한 화면**: 상단 풍경·하단 꾸미기가 **6:4** 비율(`flex-[6]`/`flex-[4]`)로 나뉨
 * - 섬 무대는 `ChildHomeIslandStage` 의 `density="flex"` 로 남는 세로 공간에 맞춤
 * - 상단: 풍경 PNG 는 끄고(`showBackground={false}`) 페이지 기본 배경만 사용. 연속일·크레딧 알약(StatPill)은 표시하지 않음.
 * - 칭찬 스티커(곰)는 **화면 오른쪽 아래 플로팅**, 성장 지도는 무대 **왼쪽** 지도 단추로만 엽니다.
 * - 부모가 칭찬 스티커를 내면 팝업 후 곰돌이 판에서 붙일 수 있음
 */
export default function HomeTab({
  childId,
  initialStats,
  childName,
  growthMapData,
  initialPraiseGrants,
  initialPraisePlacements,
}: Props) {
  const [stats, setStats] = useState<ChildStats | null>(() =>
    initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null,
  )
  const [mapOpen, setMapOpen] = useState(false)
  const [bearOpen, setBearOpen] = useState(false)
  const [grants, setGrants] = useState(initialPraiseGrants)
  const [placements, setPlacements] = useState(initialPraisePlacements)
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

  /** 서버 reset-board 직후: 부모 placements 를 [] 로 두어 자식 effect 가 옛 배열로 되살리지 않게 함 */
  const clearPraiseStickerBoard = useCallback(() => {
    setPlacements([])
  }, [])

  useEffect(() => {
    const pending = grants.some((x) => x.popup_dismissed_at == null)
    setArrivalOpen(pending)
  }, [grants])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`praise_grants:${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'praise_sticker_grants',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          setGrants((prev) => [payload.new as PraiseStickerGrant, ...prev])
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [childId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`child_stats:${childId}`)
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
            normalizeChildStatsCreditsSplit(
              mergeChildStatsPatch(prev, payload.new as Record<string, unknown>),
            ),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [childId])

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

  const growthPayload: GrowthMapSheetData = stats
    ? {
        ...growthMapData,
        level: stats.current_level,
        streak: stats.streak_days,
        longestStreak: stats.longest_streak,
      }
    : growthMapData

  const sheets = (
    <>
      <GrowthMapSheet
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        childName={childName}
        stats={stats}
        data={growthPayload}
      />
      <BearStickerSheet
        open={bearOpen}
        onClose={() => setBearOpen(false)}
        childId={childId}
        initialGrants={grants}
        initialPlacements={placements}
        onInventoryChange={() => void refreshStickerPlacementsOnly()}
        onBoardCleared={clearPraiseStickerBoard}
      />
    </>
  )

  const arrivalModal = (
    <PraiseGiftArrivalModal open={arrivalOpen} onGoStickers={openBearFromGift} />
  )

  /**
   * 곰 스티커 보관함 단추를 **화면 오른쪽 아래**에 고정합니다(예전 미션 탭과 같은 위치·스타일).
   * - `fixed`: 아래로 스크롤해도 항상 같은 자리에서 열 수 있어요.
   * - 하단 탭바(60px) + 안전 영역만큼 위로 띄워 탭과 겹치지 않게 해요.
   * - 바깥은 `pointer-events-none`, 누르는 원만 `pointer-events-auto` 로 빈 화면 탭은 그대로 통과합니다.
   * - `clientReady` 가 된 뒤에만 커스텀 곰 이미지를 써서 첫 페인트와 서버 HTML 이 어긋나지 않게 합니다.
   */
  const stickerFabFloating = (
    <div className="pointer-events-none fixed bottom-[calc(60px+env(safe-area-inset-bottom,0px)+0.5rem)] right-3 z-40 sm:right-4">
      <div className="pointer-events-auto rounded-full bg-white/92 p-1 shadow-[0_10px_34px_rgba(15,23,42,0.2)] ring-[1.5px] ring-white/90 backdrop-blur-sm transition-transform active:scale-[0.96] sm:p-1.5">
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
   */
  const homeBottomPanelClass =
    'relative z-10 -mt-8 flex min-h-0 flex-[4] basis-0 flex-col gap-1 overflow-hidden px-1 pb-2 pt-1 sm:-mt-10'

  if (!stats) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col">
          {/** `showBackground={false}`: 큰 풍경 그림 없이 깔끔한 상단 영역만 */}
          <ChildHomeSceneryBand flexFill showBackground={false} ariaLabel="홈 상단">
            <div className="shrink-0 space-y-2 py-1 text-center">
              <p className="text-sm text-gray-500">부모님이 미션을 만들어주실 거야.</p>
            </div>
            {/** `flex-1 min-h-0`: 풍경 밴드 안에서 섬이 남는 높이를 쓰고, 작은 화면에서도 잘리지 않게 줄어듦 */}
            <div className="flex min-h-0 flex-1 flex-col justify-end">
              {/**
               * 성장 지도 단추만 무대 **왼쪽** 세로 가운데 — 곰 스티커는 화면 오른쪽 아래 플로팅으로 옮겼습니다.
               * `pointer-events-none` 으로 빈 곳 탭은 통과하고 지도 단추만 눌리게 합니다.
               */}
              <div className="relative mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col items-center justify-end -mt-6 sm:-mt-8">
                {/**
                 * 성장 지도(지도 아이콘) 단추 위치
                 * - 요청사항: "왼쪽 상단" 배치
                 * - `pointer-events-none` 으로 빈 영역 탭은 통과시키고, 버튼만 `pointer-events-auto` 로 눌리게 합니다.
                 */}
                <div className="pointer-events-none absolute left-0 top-0 z-20 flex items-start pl-0.5 pt-3 sm:pl-1 sm:pt-4">
                  <div className="pointer-events-auto shrink-0">
                    <MapActionPill onClick={() => setMapOpen(true)} />
                  </div>
                </div>
                {/**
                 * 오늘 날씨 배지 위치
                 * - 요청사항: "캐릭터(토끼) 영역의 오른쪽 상단"
                 * - 지도 버튼과 균형을 맞춰 무대 컨테이너 우상단에 고정합니다.
                 */}
                <div className="absolute right-0 top-0 z-20 pr-0.5 pt-3 sm:pr-1 sm:pt-4">
                  <TodayWeatherBadge />
                </div>
                <ChildHomeIslandStage density="flex" />
              </div>
            </div>
          </ChildHomeSceneryBand>
          <section className={homeBottomPanelClass} aria-label="내 캐릭터 꾸미기">
            <CharacterDecorInventoryPlaceholder />
          </section>
        </div>
        {stickerFabFloating}
        {sheets}
        {arrivalModal}
      </>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChildHomeSceneryBand flexFill showBackground={false} ariaLabel="홈 상단">
        {/** 토끼·섬 무대만 `-mt` — 레벨업 배너는 아래 줄이라 같이 당겨지지 않음 */}
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5">
          <div className="relative mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col items-center justify-end -mt-6 sm:-mt-8">
            {/**
             * 성장 지도(지도 아이콘) 단추 위치
             * - 요청사항: "왼쪽 상단" 배치
             * - 로딩/정상 화면에서 동일한 좌표를 사용해 UX 를 일관되게 합니다.
             */}
            <div className="pointer-events-none absolute left-0 top-0 z-20 flex items-start pl-0.5 pt-3 sm:pl-1 sm:pt-4">
              <div className="pointer-events-auto shrink-0">
                <MapActionPill onClick={() => setMapOpen(true)} />
              </div>
            </div>
            {/**
             * 오늘 날씨 배지 위치(정상 화면)
             * - 로딩 화면과 동일한 우상단 좌표를 사용해 사용자 경험을 맞춥니다.
             */}
            <div className="absolute right-0 top-0 z-20 pr-0.5 pt-3 sm:pr-1 sm:pt-4">
              <TodayWeatherBadge />
            </div>
            <ChildHomeIslandStage density="flex" />
          </div>
          {stats.promotion_pending && (
            <div className="flex items-center gap-2 rounded-xl border border-brand-yellow bg-brand-yellow/40 px-4 py-2">
              <span className="text-xs font-bold text-brand-text">레벨 업 대기 중! 부모님 확인을 기다려요</span>
            </div>
          )}
        </div>
      </ChildHomeSceneryBand>

      <section className={homeBottomPanelClass} aria-label="내 캐릭터 꾸미기">
        <CharacterDecorInventoryPlaceholder />
      </section>

      {stickerFabFloating}
      {sheets}
      {arrivalModal}
    </div>
  )
}

/** 슬롯 한 칸 — 마켓 연동 시 썸네일로 교체 예정 */
function DecorInventorySlot({ label = '비어 있음' }: { label?: string }) {
  /** `flex-1` + `min-h`: 아래 40% 영역 높이를 2행이 나눠 써서 하단 빈 공간이 덜 보이게 함 */
  return (
    <li className="flex min-h-[44px] flex-1 basis-0 w-full items-center justify-center rounded-xl border border-amber-100/80 bg-[#f7f4eb] text-center text-[10px] font-medium text-gray-400 shadow-sm">
      {label}
    </li>
  )
}

/**
 * 꾸미기 인벤토리 — 제목 아래 **2행 고정**, 열 방향으로 가로 스냅 스크롤(미션 카드와 유사).
 * 8칸 = 4열(가로 스크롤) × 2행(고정): 열 c 는 인덱스 c(위)·c+4(아래).
 */
function CharacterDecorInventoryPlaceholder() {
  const cols = 4

  return (
    /** 하단 패널 안에서 제목은 고정 높이, 슬롯 줄만 남는 세로 공간을 씀(세로 스크롤 없음). */
    <div className="flex min-h-0 w-full flex-1 flex-col pt-0.5" aria-labelledby="child-decor-heading">
      {/** 제목·부제는 미션 「오늘의 미션」 줄과 같은 글자 크기·굵기 체계(`font-black`, `leading-tight`) */}
      <div className="mb-1 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1">
        <h2 id="child-decor-heading" className="text-base font-black leading-tight text-brand-text">
          내 캐릭터 꾸미기
        </h2>
        <p className="text-[8px] font-black leading-tight text-gray-500">나만의 캐릭터를 꾸며요. &gt;</p>
      </div>
      <div
        className="-mx-1 min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-2 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex h-full min-h-0 w-max gap-1.5" role="presentation">
          {Array.from({ length: cols }).map((_, c) => (
            <ul
              key={c}
              className="flex h-full min-h-0 w-[min(28vw,112px)] shrink-0 snap-center list-none flex-col gap-1.5 p-0"
              aria-label={`꾸미기 슬롯 열 ${c + 1}`}
            >
              {[c, c + cols].map((idx) => (
                <DecorInventorySlot key={`decor-slot-${idx}`} />
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  )
}

