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
 * - 홈만 풍경 밴드에 `className` 으로 배경·알약·섬·토끼 묶음을 한꺼번에 살짝 위로
 * - 섬 박스는 `ChildHomeIslandStage` 가 미션 섬과 같은 높이 + 홈용 추가 translate
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
    setGrants((prev) => {
      const merged = mergePraiseStickerGrantsFromServer(initialPraiseGrants, prev)
      const restoredDismiss = merged.filter(
        (g) =>
          g.popup_dismissed_at != null &&
          initialPraiseGrants.find((s) => s.id === g.id)?.popup_dismissed_at == null,
      ).length
      // #region agent log
      if (restoredDismiss > 0) {
        fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f7174a' },
          body: JSON.stringify({
            sessionId: 'f7174a',
            location: 'HomeTab.tsx:grantsSync',
            message: 'kept client popup_dismissed over stale server row',
            data: { restoredDismiss },
            timestamp: Date.now(),
            runId: 'verify2',
            hypothesisId: 'H4',
          }),
        }).catch(() => {})
      }
      // #endregion
      return merged
    })
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
    const { data: updatedRows, error } = await supabase
      .from('praise_sticker_grants')
      .update({ popup_dismissed_at: now })
      .eq('child_id', childId)
      .is('popup_dismissed_at', null)
      .select('id')
    // #region agent log
    fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f7174a' },
      body: JSON.stringify({
        sessionId: 'f7174a',
        location: 'HomeTab.tsx:dismissArrival',
        message: 'popup_dismissed_at DB update',
        data: {
          hasError: Boolean(error),
          err: error?.message ?? null,
          updatedCount: Array.isArray(updatedRows) ? updatedRows.length : 0,
        },
        timestamp: Date.now(),
        runId: 'verify2',
        hypothesisId: 'H2',
      }),
    }).catch(() => {})
    // #endregion
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

  /** 미션 `bottomPanel` 과 동일: 최소 40dvh + 남는 높이 흡수 + 배경 그라데이션 */
  const homeDecorPanelClass =
    'flex min-h-[40dvh] flex-1 flex-col gap-2 overflow-y-auto bg-gradient-to-b from-lime-50/80 via-amber-50/30 to-white px-1 pb-2 pt-2'

  /** 배경 이미지 + 상단 알약 + 섬·토끼 블록 전체를 조금 위로 (미션 탭은 className 미전달) */
  const homeSceneryLiftClass = '-translate-y-7 sm:-translate-y-9'

  if (!stats) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col">
          <ChildHomeSceneryBand ariaLabel="홈 배경" className={homeSceneryLiftClass}>
            <div className="shrink-0 space-y-2 py-1 text-center">
              <p className="text-sm text-gray-500">부모님이 미션을 만들어주실 거야.</p>
              <div className="mt-8 flex w-full items-center justify-center gap-2">
                <MapActionPill onClick={() => setMapOpen(true)} />
                <StickerActionPill
                  useCustomImage={clientReady && stickerFabImgOk}
                  onImageError={() => setStickerFabImgOk(false)}
                  onClick={openBearFromFab}
                />
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-end">
              <div className="relative mx-auto flex w-full max-w-sm flex-col items-center">
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
      <ChildHomeSceneryBand ariaLabel="홈 배경" className={homeSceneryLiftClass}>
        <div className="mt-8 flex w-full shrink-0 items-center justify-between gap-1.5 sm:mt-10">
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

        <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5">
          <div className="relative mx-auto flex w-full max-w-sm flex-col items-center">
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

/**
 * 꾸미기 인벤토리 — 위에 제목·부제 한 줄, 아래는 슬롯마다 둥근 블록만.
 * (실제 아이템은 마켓 구매 후 썸네일로 채울 예정)
 */
function CharacterDecorInventoryPlaceholder() {
  return (
    <div className="w-full pt-0.5" aria-labelledby="child-decor-heading">
      {/* 메인 제목 옆에 회색 작은 설명(화살표는 더 보기 느낌용) */}
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 id="child-decor-heading" className="text-base font-bold text-brand-text">
          내 캐릭터 꾸미기
        </h2>
        <p className="text-[11px] leading-tight text-gray-500">나만의 캐릭터를 꾸며요! &gt;</p>
      </div>
      <ul className="grid w-full grid-cols-3 gap-2.5" aria-label="꾸미기 아이템 칸">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="flex aspect-square items-center justify-center rounded-xl border border-amber-100/80 bg-[#f7f4eb] text-center text-[10px] font-medium text-gray-400 shadow-sm"
          >
            비어 있음
          </li>
        ))}
      </ul>
    </div>
  )
}

