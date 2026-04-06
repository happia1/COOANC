'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChildStats, PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'
import GrowthMapSheet, { type GrowthMapSheetData } from '@/components/child/GrowthMapSheet'
import BearStickerSheet from '@/components/child/BearStickerSheet'
import PraiseGiftArrivalModal from '@/components/child/PraiseGiftArrivalModal'
import ChildHomeIslandStage from '@/components/child/ChildHomeIslandStage'
import ChildHomeSceneryBand from '@/components/child/ChildHomeSceneryBand'
import { MapActionPill, StatPill, StickerActionPill } from '@/components/child/ChildSceneryTopPills'
import { mergePraiseStickerGrantsFromServer } from '@/lib/mergePraiseStickerGrantsFromServer'

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
 * - 상단·하단 비율은 **미션 탭과 동일**: `ChildHomeSceneryBand` = 60dvh, 하단 = min 40dvh + flex-1 + 라임 그라데이션
 * - 풍경: `object-center` + 배경 레이어만 `CHILD_HOME_SCENERY_BG_LIFT_CLASS` 로 위로(알약·섬은 그대로)
 * - 토끼·섬만 `ChildHomeIslandStage` 래퍼: 이전 `-mt-10`/`12` 대비 **약 3배** 당김(`7.5rem` / `9rem`)
 * - EXP 바는 홈에서 숨김 · 꾸미기는 슬롯별 블록
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
  const [stats, setStats] = useState<ChildStats | null>(initialStats)
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
          setStats(payload.new as ChildStats)
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
      />
    </>
  )

  const arrivalModal = (
    <PraiseGiftArrivalModal open={arrivalOpen} onGoStickers={openBearFromGift} />
  )

  /**
   * 풍경에 붙여 올림(`-mt-*`). 배경 블록(그라데이션) 없이 레이아웃만.
   * `-mt-*` 로 풍경·섬과 겹치며 꾸미기 블록을 위로 붙임(알약 행은 그대로).
   */
  const homeDecorPanelClass =
    '-mt-20 relative z-10 flex min-h-[40dvh] flex-1 flex-col gap-2 overflow-y-auto px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mt-24'

  if (!stats) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col">
          <ChildHomeSceneryBand ariaLabel="홈 배경">
            <div className="shrink-0 space-y-2 py-1 text-center">
              <p className="text-sm text-gray-500">부모님이 미션을 만들어주실 거야.</p>
              <div className="mt-1 flex w-full items-center justify-center gap-2">
                <MapActionPill onClick={() => setMapOpen(true)} />
                <StickerActionPill
                  useCustomImage={clientReady && stickerFabImgOk}
                  onImageError={() => setStickerFabImgOk(false)}
                  onClick={openBearFromFab}
                />
              </div>
            </div>
            {/** 스탯 없을 때도 섬·(없음) 무대만 위로 — 알약·문구는 그대로 */}
            <div className="flex min-h-0 flex-1 flex-col justify-end">
              <div className="relative mx-auto flex w-full max-w-sm flex-col items-center -mt-[7.5rem] sm:-mt-[9rem]">
                <ChildHomeIslandStage />
              </div>
            </div>
          </ChildHomeSceneryBand>
          <section className={homeDecorPanelClass} aria-label="내 캐릭터 꾸미기">
            <CharacterDecorInventoryPlaceholder />
          </section>
        </div>
        {sheets}
        {arrivalModal}
      </>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChildHomeSceneryBand ariaLabel="홈 배경">
        {/** 상단 여백 거의 없음 — 부모 `pt-4` 만으로 알약과 가장자리 간격 유지 */}
        <div className="mt-0 flex w-full shrink-0 items-center justify-between gap-1.5 sm:mt-1">
          <StatPill label="연속" value={`${stats.streak_days}일`} className="shrink-0" />
          <div className="flex shrink-0 items-center gap-1.5">
            <MapActionPill onClick={() => setMapOpen(true)} />
            <StickerActionPill
              useCustomImage={clientReady && stickerFabImgOk}
              onImageError={() => setStickerFabImgOk(false)}
              onClick={openBearFromFab}
            />
          </div>
          <StatPill
            label="크레딧"
            value={stats.credits.toLocaleString('ko-KR')}
            highlight
            className="shrink-0"
          />
        </div>

        {/** 토끼·섬 무대만 `-mt` — 레벨업 배너는 아래 줄이라 같이 당겨지지 않음 */}
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5">
          <div className="relative mx-auto flex w-full max-w-sm flex-col items-center -mt-[7.5rem] sm:-mt-[9rem]">
            <ChildHomeIslandStage />
          </div>
          {stats.promotion_pending && (
            <div className="flex items-center gap-2 rounded-xl border border-brand-yellow bg-brand-yellow/40 px-4 py-2">
              <span className="text-xs font-bold text-brand-text">레벨 업 대기 중! 부모님 확인을 기다려요</span>
            </div>
          )}
        </div>
      </ChildHomeSceneryBand>

      <section className={homeDecorPanelClass} aria-label="내 캐릭터 꾸미기">
        <CharacterDecorInventoryPlaceholder />
      </section>

      {sheets}
      {arrivalModal}
    </div>
  )
}

/** 슬롯 한 칸 — 마켓 연동 시 썸네일로 교체 예정 */
function DecorInventorySlot({ label = '비어 있음' }: { label?: string }) {
  return (
    <li className="flex aspect-square w-full items-center justify-center rounded-xl border border-amber-100/80 bg-[#f7f4eb] text-center text-[10px] font-medium text-gray-400 shadow-sm">
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
    <div className="w-full pt-0.5" aria-labelledby="child-decor-heading">
      {/** 제목·부제는 미션 「오늘의 미션」 줄과 같은 글자 크기·굵기 체계(`font-black`, `leading-tight`) */}
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 id="child-decor-heading" className="text-base font-black leading-tight text-brand-text">
          내 캐릭터 꾸미기
        </h2>
        <p className="text-[11px] font-black leading-tight text-gray-500">나만의 캐릭터를 꾸며요! &gt;</p>
      </div>
      <div
        className="-mx-1 overflow-x-auto overflow-y-hidden px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex w-max gap-1.5 pb-0.5" role="presentation">
          {Array.from({ length: cols }).map((_, c) => (
            <ul
              key={c}
              className="flex w-[min(28vw,112px)] shrink-0 snap-center list-none flex-col gap-1.5 p-0"
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

