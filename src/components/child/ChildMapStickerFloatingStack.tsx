'use client'

/**
 * 홈 탭(`HomeTab`)과 **같은 좌표 규칙**으로 지도·스티커 단추를 올리고, 항해지도·곰 스티커 시트를 엽니다.
 * 미션 탭 등 다른 화면에서 재사용 — `relative` 부모 안 첫 자식으로 두면 `absolute top-0` 이 홈 무대와 맞춰집니다.
 */

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChildStats, PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'
import NavigationMapSheet from '@/components/child/NavigationMapSheet'
import BearStickerSheet from '@/components/child/BearStickerSheet'
import PraiseGiftArrivalModal from '@/components/child/PraiseGiftArrivalModal'
import { MapActionPill, StickerActionPill } from '@/components/child/ChildSceneryTopPills'
import { mergePraiseStickerGrantsFromServer } from '@/lib/mergePraiseStickerGrantsFromServer'

export type ChildMapStickerFloatingStackProps = {
  childId: string
  childName: string
  stats: ChildStats | null
  setStats: Dispatch<SetStateAction<ChildStats | null>>
  initialPraiseGrants: PraiseStickerGrant[]
  initialPraisePlacements: PraiseStickerPlacement[]
}

export default function ChildMapStickerFloatingStack({
  childId,
  childName,
  stats,
  setStats,
  initialPraiseGrants,
  initialPraisePlacements,
}: ChildMapStickerFloatingStackProps) {
  const [mapOpen, setMapOpen] = useState(false)
  const [bearOpen, setBearOpen] = useState(false)
  const [grants, setGrants] = useState(initialPraiseGrants)
  const [placements, setPlacements] = useState(initialPraisePlacements)
  const [praiseGrantsRevision, setPraiseGrantsRevision] = useState(0)
  const [arrivalOpen, setArrivalOpen] = useState(false)
  /** `sticker_icon.png` 로드 실패 시에만 말풍선 SVG로 바꿉니다. (홈은 하이드레이션 이슈로 `clientReady` 를 쓰지만, 미션은 첫 화면부터 곰 얼굴을 씁니다.) */
  const [stickerFabImgOk, setStickerFabImgOk] = useState(true)

  useEffect(() => {
    setGrants((prev) => mergePraiseStickerGrantsFromServer(initialPraiseGrants, prev))
  }, [initialPraiseGrants])

  useEffect(() => {
    setPlacements(initialPraisePlacements)
  }, [initialPraisePlacements])

  const refreshStickerPlacementsOnly = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('praise_sticker_placements').select('*').eq('child_id', childId)
    if (data) setPlacements(data as PraiseStickerPlacement[])
  }, [childId])

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
    [setStats],
  )

  useEffect(() => {
    setArrivalOpen(grants.some((x) => x.popup_dismissed_at == null))
  }, [grants])

  /** 아직 팝업을 보지 않은 가장 최근 스티커 — 랜덤 발급 이미지 표시용 */
  const pendingArrivalGrant = useMemo(() => {
    const pending = grants.filter((g) => g.popup_dismissed_at == null)
    if (pending.length === 0) return null
    return pending.reduce((latest, g) =>
      new Date(g.created_at) >= new Date(latest.created_at) ? g : latest,
    )
  }, [grants])

  /** Realtime 제거 — 스티커 시트·저장 시점의 일반 조회로만 동기화합니다. */

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

  /**
   * 홈과 비슷한 오른쪽 상단이지만, 미션 탭에서 스티커를 **왼쪽(중앙 쪽)** 으로 당깁니다(`right-5` / `sm:right-7` — 숫자만 키우면 더 안쪽).
   */
  const stickerTopRightButton = (
    <div className="pointer-events-none absolute right-5 top-0 z-20 pr-0.5 pt-5 sm:right-7 sm:pr-1 sm:pt-6">
      <div className="pointer-events-auto shrink-0">
        <StickerActionPill
          useCustomImage={stickerFabImgOk}
          onImageError={() => setStickerFabImgOk(false)}
          onClick={openBearFromFab}
        />
      </div>
    </div>
  )

  return (
    <>
      {/**
       * `HomeTab` 무대의 `mx-auto max-w-sm` 과 동일: 가로 중앙 `max-w-sm` 안에서 좌/우 `absolute`.
       */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[25] flex justify-center">
        <div className="relative w-full max-w-sm">
          {/** 지도 단추: 홈보다 **오른쪽** — `left-5` / `sm:left-7` 로 기준을 안쪽으로 옮김(값 키우면 더 오른쪽). */}
          <div className="pointer-events-none absolute left-5 top-0 z-20 flex items-start pl-0.5 pt-5 sm:left-7 sm:pl-1 sm:pt-6">
            <div className="pointer-events-auto shrink-0">
              <MapActionPill onClick={() => setMapOpen(true)} />
            </div>
          </div>
          {stickerTopRightButton}
        </div>
      </div>

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
        serverPraiseBoardClearedAt={stats?.praise_board_cleared_at ?? null}
        onInventoryChange={() => void refreshStickerPlacementsOnly()}
        onBoardCleared={clearPraiseStickerBoard}
        praiseGrantsRevision={praiseGrantsRevision}
      />
      <PraiseGiftArrivalModal
        open={arrivalOpen}
        spriteKey={pendingArrivalGrant?.sprite_key ?? null}
        onGoStickers={openBearFromGift}
        onClose={dismissArrival}
      />
    </>
  )
}
