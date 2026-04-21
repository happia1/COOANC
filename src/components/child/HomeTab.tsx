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
import { useChildAppProfile } from '@/context/ProfileContext'

type Props = {
  childId: string
  initialStats: ChildStats | null
  childName: string
  childAvatarUrl?: string | null
  growthMapData?: Record<string, unknown>
  initialPraiseGrants: PraiseStickerGrant[]
  initialPraisePlacements: PraiseStickerPlacement[]
  initialUnlockedItemIndexes?: number[]
  initialMapOpen?: boolean
}

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
  const profile = useChildAppProfile()
  const exitHref = profile?.exitHref ?? '/parent/home'

  const [stats, setStats] = useState<ChildStats | null>(() =>
    initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null,
  )
  const [mapOpen, setMapOpen] = useState(initialMapOpen)
  const [unlockedItemIndexes, setUnlockedItemIndexes] = useState<number[]>(initialUnlockedItemIndexes)
  const [itemUnlockPopup, setItemUnlockPopup] = useState<{ index: number; triggerKey: TriggerKey } | null>(null)
  const effectiveDecorUnlocked = CHARACTER_DECOR_UI_FORCE_ALL_LOCKED ? [] : unlockedItemIndexes
  const [bearOpen, setBearOpen] = useState(false)
  const [grants, setGrants] = useState(initialPraiseGrants)
  const [placements, setPlacements] = useState(initialPraisePlacements)
  const [praiseGrantsRevision, setPraiseGrantsRevision] = useState(0)
  const [arrivalOpen, setArrivalOpen] = useState(false)
  const [stickerFabImgOk, setStickerFabImgOk] = useState(true)
  const [clientReady, setClientReady] = useState(false)

  useEffect(() => { setClientReady(true) }, [])

  useEffect(() => {
    setStats(initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null)
  }, [initialStats])

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

  const dismissArrival = useCallback(async () => {
    const now = new Date().toISOString()
    setGrants((prev) => prev.map((g) => (g.popup_dismissed_at ? g : { ...g, popup_dismissed_at: now })))
    setArrivalOpen(false)
    const supabase = createClient()
    await supabase
      .from('praise_sticker_grants')
      .update({ popup_dismissed_at: now })
      .eq('child_id', childId)
      .is('popup_dismissed_at', null)
  }, [childId])

  const openBearFromFab = useCallback(() => { setBearOpen(true) }, [])
  const openBearFromGift = useCallback(() => {
    setBearOpen(true)
    void dismissArrival()
  }, [dismissArrival])

  const sheets = (
    <>
      <NavigationMapSheet open={mapOpen} onClose={() => setMapOpen(false)} childName={childName} stats={stats} />
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
    </>
  )

  const arrivalModal = <PraiseGiftArrivalModal open={arrivalOpen} onGoStickers={openBearFromGift} />

  /**
   * 곰 스티커 단추 — 모바일: fixed top-right / 태블릿 landscape: 숨김(HomeTab 왼쪽 패널 overlay 사용).
   */
  const stickerTopRightButton = (
    <div
      className="pointer-events-none fixed right-3 z-50 md:landscape:hidden"
      style={{ top: 'max(12px, env(safe-area-inset-top))' }}
    >
      <div className="pointer-events-auto shrink-0">
        <StickerActionPill
          useCustomImage={clientReady && stickerFabImgOk}
          onImageError={() => setStickerFabImgOk(false)}
          onClick={openBearFromFab}
        />
      </div>
    </div>
  )

  const homeBottomPanelClass =
    'relative z-10 mt-5 flex min-h-0 flex-[4] basis-0 flex-col gap-1 overflow-hidden px-3 pb-2 pt-0.5 sm:mt-6 md:landscape:hidden'

  /**
   * 홈 탭 루트:
   * - 모바일: full-bleed (-mx-4 -mt-4 w-[calc(100%+2rem)]) flex-col
   * - 태블릿 landscape: flex-row, 패딩 취소(md:landscape:mx-0 mt-0 w-full)
   */
  const homeFullBleedShellClass =
    'relative isolate -mx-4 -mt-4 box-border flex min-h-0 min-w-0 w-[calc(100%+2rem)] max-w-none flex-1 shrink-0 flex-col self-stretch overflow-visible' +
    ' md:landscape:mx-0 md:landscape:mt-0 md:landscape:w-full md:landscape:flex-row md:landscape:overflow-hidden'

  /**
   * 배경 이미지 (모바일: 전체 / 태블릿: 왼쪽 패널만)
   */
  const homeTabFullBackground = (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <img
        src={`${ASSETS.layouts.childHomeBackgroundSecondScreen}?v=${CHILD_HOME_BACKGROUND_CACHE_BUST}`}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover object-[center_90%] brightness-[1.2]`}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        draggable={false}
      />
    </div>
  )

  /**
   * 태블릿 landscape 전용: 왼쪽 패널 상단 overlay 아이콘
   * 모바일에서는 숨깁니다(hidden md:landscape:flex).
   */
  const tabletOverlayIcons = (
    <>
      {/* top-center: "나의 꾸미기 방" title */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-20 hidden -translate-x-1/2 md:landscape:block">
        <span className="text-sm font-black text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.45)]">나의 꾸미기 방</span>
      </div>

      {/* top-right: map + sticker */}
      <div className="pointer-events-none absolute right-4 top-4 z-20 hidden gap-2 md:landscape:flex">
        <OverlayIconButton onClick={() => setMapOpen(true)} ariaLabel="항해지도 열기">
          <Image src="/assets/img/common/ui/map.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
        </OverlayIconButton>
        <OverlayIconButton onClick={openBearFromFab} ariaLabel="스티커 보관함 열기">
          <Image src="/assets/img/common/ui/sticker_icon.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
        </OverlayIconButton>
      </div>
    </>
  )

  /**
   * 섬·캐릭터 무대 (stats 유무에 따라 내부 내용 분기)
   */
  const islandSection = (
    <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5">
      <div className="relative mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col items-center justify-end -mt-2 sm:-mt-4">
        {/* 지도 단추: 모바일용 (태블릿에서는 overlay 사용) */}
        <div className="pointer-events-none absolute left-0 top-0 z-20 flex items-start pl-0.5 pt-5 sm:pl-1 sm:pt-6 md:landscape:hidden">
          <div className="pointer-events-auto shrink-0">
            <MapActionPill onClick={() => setMapOpen(true)} />
          </div>
        </div>
        {stickerTopRightButton}
        <ChildHomeIslandStage density="flex" homeAvatarUrl={childAvatarUrl} showIslandArt={false} />
      </div>
    </div>
  )

  return (
    <>
      <div className={homeFullBleedShellClass}>
        {/**
         * 왼쪽 패널 (모바일: 전체 화면 / 태블릿 landscape: 50%)
         * - background가 이 div 안에 있어 태블릿에서 왼쪽 절반만 덮음
         */}
        <div className="relative flex flex-1 flex-col min-h-0 md:landscape:w-1/2 md:landscape:flex-none md:landscape:overflow-hidden">
          {homeTabFullBackground}
          {tabletOverlayIcons}

          {/* 캐릭터 영역 */}
          <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
            {!stats && (
              <div className="shrink-0 space-y-2 py-1 text-center">
                <p className="text-sm text-gray-500">부모님이 미션을 만들어주실 거야.</p>
              </div>
            )}
            <ChildHomeSceneryBand
              edgeBleed={false}
              flexFill
              flexFillWeight={stats ? 5.5 : undefined}
              showBackground={false}
              ariaLabel="홈 상단"
            >
              {islandSection}
            </ChildHomeSceneryBand>

            {/* 모바일 전용 꾸미기 인벤토리 */}
            <section className={homeBottomPanelClass} aria-label="내 캐릭터 꾸미기">
              <CharacterDecorInventory unlockedIndexes={effectiveDecorUnlocked} />
            </section>
          </div>
        </div>

        {/**
         * 오른쪽 패널 — 태블릿 landscape 전용 꾸미기 상점
         */}
        <div className="hidden md:landscape:flex md:landscape:w-1/2 flex-col bg-white overflow-hidden border-l border-gray-100">
          <TabletDecorPanel
            unlockedIndexes={effectiveDecorUnlocked}
            stats={stats}
          />
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

// ─── Sub-components ────────────────────────────────────────────────

/** 태블릿 왼쪽 패널 overlay 아이콘 버튼 */
function OverlayIconButton({
  children,
  onClick,
  href,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  ariaLabel: string
}) {
  const cls = 'pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm transition active:scale-95 focus-visible:outline-none'
  if (href) {
    return <a href={href} className={cls} aria-label={ariaLabel}>{children}</a>
  }
  return (
    <button type="button" onClick={onClick} className={cls} aria-label={ariaLabel}>
      {children}
    </button>
  )
}

// ─── Decor categories ──────────────────────────────────────────────

const DECOR_CATEGORIES = [
  { id: 'outfit' as const, label: '옷' },
  { id: 'accessory' as const, label: '악세서리' },
  { id: 'hair' as const, label: '헤어' },
  { id: 'background' as const, label: '배경' },
] as const

type DecorCategoryId = (typeof DECOR_CATEGORIES)[number]['id']

const DECOR_ITEM_PRICE = 300

const TOTAL_ITEMS = ASSETS.characters.decorItemImages.length

/** 아이템 인덱스 → 카테고리 매핑 (placeholder split — 실제 카테고리 확정 후 갱신 필요) */
function getCategoryForIndex(index: number): DecorCategoryId {
  if (index < Math.ceil(TOTAL_ITEMS * 0.34)) return 'outfit'
  if (index < Math.ceil(TOTAL_ITEMS * 0.6)) return 'accessory'
  if (index < Math.ceil(TOTAL_ITEMS * 0.83)) return 'hair'
  return 'background'
}

// ─── Category icon SVGs ────────────────────────────────────────────

function CategoryIcon({ id, className }: { id: DecorCategoryId; className?: string }) {
  const cls = className ?? 'h-5 w-5'
  switch (id) {
    case 'outfit':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M20 7l-4-3H8L4 7l3 2v9h10V9l3-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 4c0 1.1.9 2 2 2h4a2 2 0 000-4H10a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'accessory':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 12h16M4 12c0-2 2-4 4-4s2 2 4 2 2-2 4-2 4 2 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M4 12c0 2 2 4 4 4s2-2 4-2 2 2 4 2 4-2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'hair':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'background':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 15l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
        </svg>
      )
  }
}

// ─── Tablet right panel ────────────────────────────────────────────

function TabletDecorPanel({
  unlockedIndexes,
  stats,
}: {
  unlockedIndexes: number[]
  stats: ChildStats | null
}) {
  const [activeCategory, setActiveCategory] = useState<DecorCategoryId>('outfit')

  const filteredItems = ASSETS.characters.decorItemImages
    .map((src, index) => ({ src, index }))
    .filter(({ index }) => getCategoryForIndex(index) === activeCategory)

  const walletCredits = stats?.credits_wallet ?? stats?.credits ?? 0

  return (
    <>
      {/* Category tab bar */}
      <div className="flex shrink-0 flex-row justify-around border-b border-gray-100 bg-white py-2">
        {DECOR_CATEGORIES.map(({ id, label }) => {
          const isActive = activeCategory === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveCategory(id)}
              className={[
                'flex flex-col items-center gap-1 px-2 pb-1 pt-0.5 text-xs font-bold transition-colors',
                isActive
                  ? 'border-b-2 border-brand-blue text-brand-blue'
                  : 'border-b-2 border-transparent text-slate-400',
              ].join(' ')}
            >
              <CategoryIcon id={id} className="h-5 w-5" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto p-4 [scrollbar-width:thin]">
        {filteredItems.length === 0 ? (
          <p className="pt-8 text-center text-sm text-gray-400">아이템이 없어요</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {filteredItems.map(({ src, index }) => {
              const owned = unlockedIndexes.includes(index)
              return (
                <div
                  key={index}
                  className={[
                    'relative flex flex-col overflow-hidden rounded-lg border bg-white',
                    owned ? 'border-brand-blue ring-2 ring-brand-blue/30' : 'border-gray-100',
                  ].join(' ')}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={src}
                      alt=""
                      fill
                      loading="lazy"
                      sizes="(max-width: 1024px) 14vw, 10vw"
                      className={`object-contain p-1 ${owned ? '' : 'grayscale opacity-60'}`}
                      draggable={false}
                    />
                    {/* Lock overlay */}
                    {!owned && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-t-lg">
                        <svg className="h-4 w-4 text-white drop-shadow" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <rect x="4" y="11" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                          <circle cx="12" cy="16" r="1.25" fill="currentColor" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Price / owned badge */}
                  <div className="flex items-center justify-center px-0.5 py-1">
                    {owned ? (
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">
                        보유
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
                        🪙 {DECOR_ITEM_PRICE}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Credit bar */}
      <div className="flex shrink-0 items-center justify-center gap-6 border-t border-gray-100 bg-white py-3">
        <span className="text-sm font-bold text-brand-text">
          보유 골드: <span className="text-amber-500">🪙 {walletCredits.toLocaleString('ko-KR')}</span>
        </span>
        {(stats?.credits_piggy ?? 0) > 0 && (
          <span className="text-sm font-bold text-brand-text">
            저금통: <span className="text-sky-600">🐷 {(stats?.credits_piggy ?? 0).toLocaleString('ko-KR')}</span>
          </span>
        )}
      </div>
    </>
  )
}

// ─── Mobile decor inventory ────────────────────────────────────────

const DECOR_ITEM_COUNT = ASSETS.characters.decorItemImages.length
const DECOR_GRID_COLS = DECOR_ITEM_COUNT / 2

function DecorLockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="11" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="16" r="1.25" fill="currentColor" />
    </svg>
  )
}

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
