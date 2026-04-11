'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChildItemUnlock, ChildStats, PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'
import NavigationMapSheet from '@/components/child/NavigationMapSheet'
import BearStickerSheet from '@/components/child/BearStickerSheet'
import PraiseGiftArrivalModal from '@/components/child/PraiseGiftArrivalModal'
import ChildHomeIslandStage from '@/components/child/ChildHomeIslandStage'
import ChildHomeSceneryBand from '@/components/child/ChildHomeSceneryBand'
import { MapActionPill, StickerActionPill } from '@/components/child/ChildSceneryTopPills'
import { mergePraiseStickerGrantsFromServer } from '@/lib/mergePraiseStickerGrantsFromServer'
import { mergeChildStatsPatch, normalizeChildStatsCreditsSplit } from '@/lib/childCreditsSplit'
import { ASSETS } from '@/constants/assets'
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
 * - 상단: 풍경 PNG 는 끄고(`showBackground={false}`) 페이지 기본 배경만 사용. 연속일·크레딧 알약(StatPill)은 표시하지 않음.
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

  /**
   * 20칸 완주 등으로 grants 행이 DB 에서 지워지면, INSERT 채널은 안 오므로 DELETE 구독으로 목록을 다시 맞춥니다.
   */
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`praise_grants_delete:${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'praise_sticker_grants',
          filter: `child_id=eq.${childId}`,
        },
        () => {
          void refreshGrantsOnly()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [childId, refreshGrantsOnly])

  /**
   * 부모가 「스티커판 비우기」로 placements 를 지우면, 아이 앱이 새로고침 없이도 칸이 비어 보이게 합니다.
   * (INSERT/UPDATE/DELETE 어떤 변화든 다시 읽어 오면 됩니다.)
   */
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`praise_placements:${childId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'praise_sticker_placements',
          filter: `child_id=eq.${childId}`,
        },
        () => {
          void refreshStickerPlacementsOnly()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [childId, refreshStickerPlacementsOnly])

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

  // 아이템 잠금 해제 실시간 구독 (다른 탭에서 트리거됐을 때 홈에서도 팝업)
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`child_item_unlocks:${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'child_item_unlocks',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          const row = payload.new as ChildItemUnlock
          setUnlockedItemIndexes((prev) =>
            prev.includes(row.item_index) ? prev : [...prev, row.item_index],
          )
          setItemUnlockPopup({ index: row.item_index, triggerKey: row.trigger_key as TriggerKey })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
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
                <ChildHomeIslandStage density="flex" homeAvatarUrl={childAvatarUrl} />
              </div>
            </div>
          </ChildHomeSceneryBand>
          <section className={homeBottomPanelClass} aria-label="내 캐릭터 꾸미기">
            <CharacterDecorInventory unlockedIndexes={unlockedItemIndexes} />
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
      </>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChildHomeSceneryBand flexFill flexFillWeight={5.5} showBackground={false} ariaLabel="홈 상단">
        {/** 토끼·섬 무대: `-mt` 는 하단 꾸미기와 살짝 겹치게만 두고, 과하게 당기지 않아 잔디·섬이 조금 더 아래에 보입니다. */}
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
            <ChildHomeIslandStage density="flex" homeAvatarUrl={childAvatarUrl} />
          </div>
        </div>
      </ChildHomeSceneryBand>

      <section className={homeBottomPanelClass} aria-label="내 캐릭터 꾸미기">
        <CharacterDecorInventory unlockedIndexes={unlockedItemIndexes} />
      </section>

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
 * 꾸미기 인벤토리 — 아이템을 **위·아래 2줄**로 두고, **한 번의 가로 스크롤**로 두 줄이 같이 밀립니다.
 * 잠금 해제된 아이템은 컬러로, 그 외는 흑백 + 준비중 레이블로 표시합니다.
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
                    aria-label={`꾸미기 아이템 ${index + 1}번${unlocked ? ', 잠금 해제됨' : ', 준비 중'}`}
                    className="pointer-events-none aspect-square w-full"
                  >
                    <div className="relative size-full overflow-hidden rounded-xl border border-amber-100/90 bg-[#f7f4eb] shadow-sm">
                      <Image
                        src={ASSETS.characters.decorItemImages[index]}
                        alt=""
                        fill
                        sizes="(max-width: 448px) 18vw, 76px"
                        className={`object-contain p-0.5 transition-all duration-500 ${unlocked ? '' : 'grayscale opacity-[0.55]'}`}
                        draggable={false}
                      />
                      {!unlocked && (
                        <>
                          <div className="pointer-events-none absolute inset-0 bg-white/35" aria-hidden />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0.5 flex justify-center px-0.5">
                            <span className="rounded-md bg-slate-700/85 px-1 py-px text-[8px] font-black tracking-tight text-white shadow-sm">
                              준비중
                            </span>
                          </div>
                        </>
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

