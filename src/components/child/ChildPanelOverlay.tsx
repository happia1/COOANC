'use client'

/**
 * ChildPanelOverlay
 *
 * 자녀 단일 화면(ChildScreen)에서 하단에서 슬라이드업 되는 패널 오버레이.
 * activePanel에 따라 마켓/코인/꾸미기/스티커 중 하나를 표시합니다.
 *
 * 비개발자 설명:
 * - 상단 바의 아이콘(🏪🪙👗⭐)을 탭하면 이 패널이 화면 아래에서 올라옵니다.
 * - 어두운 배경(딤)을 탭하거나 × 버튼을 누르면 닫힙니다.
 */

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import type { StoreItem, PurchaseRequest, ChildStats, PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'
import type { UnlockedFeatures } from '@/constants/childScreenFeatures'
import MissionCreditCards from '@/components/child/MissionCreditCards'
import { ASSETS } from '@/constants/assets'
import {
  normalizeChildStatsCreditsSplit,
  mergeChildStatsPatch,
  creditsFloating,
} from '@/lib/childCreditsSplit'
import type { CreditTransferApiSuccess, CreditTransferKind } from '@/components/child/MissionCreditMoveDialog'
import { praiseAssetStickerUrl } from '@/lib/praiseAssetStickers'
import { praiseUiKindFromSpriteKey } from '@/lib/praiseStickerUi'
import PraiseUiIcon from '@/components/common/PraiseUiIcon'
import { slotCenterPercent } from '@/lib/bearBoardLayout'

/** MarketTab은 용량이 크므로 사용 시 동적으로 불러옵니다 */
const MarketTab = dynamic(() => import('@/components/child/MarketTab'), { ssr: false })

/** BearStickerSheet — 곰돌이 스티커판 (자체 오버레이 모달) */
const BearStickerSheet = dynamic(() => import('@/components/child/BearStickerSheet'), { ssr: false })

/** 크레딧 이동 다이얼로그 — 사용 시 동적으로 불러옵니다 */
const MissionCreditMoveDialog = dynamic(
  () => import('@/components/child/MissionCreditMoveDialog'),
  { ssr: false },
)
const MissionCreditActionSheet = dynamic(
  () =>
    import('@/components/child/MissionCreditMoveDialog').then((m) => ({
      default: m.MissionCreditActionSheet,
    })),
  { ssr: false },
)

export type PanelType = 'market' | 'coins' | 'dressup' | 'sticker' | null

type Props = {
  /** 현재 열린 패널 종류 (null = 닫힘) */
  active: PanelType
  /** 패널 닫기 콜백 */
  onClose: () => void

  /** 자녀 ID */
  childId: string
  /** 해금된 기능 목록 */
  features: UnlockedFeatures

  /* ── 마켓 패널 props ── */
  marketEligibleItems: StoreItem[]
  initialHiddenStoreItemIds: string[]
  marketRequests: PurchaseRequest[]
  initialWishlistEntries: { storeItemId: string; quantity: number }[]
  creditsWallet: number
  level: number

  /* ── 코인 패널 props ── */
  childStats: ChildStats | null
  /** stats가 변경되면 ChildScreen에 알립니다 */
  onStatsUpdate: (patch: { credits: number; credits_wallet: number; credits_piggy: number }) => void

  /* ── 꾸미기 패널 props ── */
  unlockedItemIndexes: number[]

  /* ── 스티커 패널 props ── */
  praiseGrants: PraiseStickerGrant[]
  praisePlacements: PraiseStickerPlacement[]
  serverPraiseBoardClearedAt: string | null
  onPraiseBoardCleared: (clearedAt?: string, meta?: { grantsDeleted?: boolean }) => void
  praiseGrantsRevision: number
  onInventoryChange: () => void
}

/** 패널 제목 매핑 */
const PANEL_TITLES: Record<NonNullable<PanelType>, string> = {
  market: '마켓',
  coins: '내 크레딧',
  dressup: '캐릭터 꾸미기',
  sticker: '칭찬 스티커 판',
}

export default function ChildPanelOverlay({
  active,
  onClose,
  childId,
  features,
  marketEligibleItems,
  initialHiddenStoreItemIds,
  marketRequests,
  initialWishlistEntries,
  creditsWallet,
  level,
  childStats,
  onStatsUpdate,
  unlockedItemIndexes,
  praiseGrants,
  praisePlacements,
  serverPraiseBoardClearedAt,
  onPraiseBoardCleared,
  praiseGrantsRevision,
  onInventoryChange,
}: Props) {
  /** 슬라이드업 패널은 market/coins/dressup 전용 — sticker는 BearStickerSheet 가 자체 모달 관리 */
  const isSlideUpOpen = active !== null && active !== 'sticker'

  return (
    <>
    <div
      className={`fixed inset-0 z-[80] ${isSlideUpOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      {/* 딤 배경 — 탭하면 닫힘 */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isSlideUpOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden
      />

      {/* 패널 본체 — 하단에서 슬라이드업 */}
      <div
        className={[
          'absolute bottom-0 left-0 right-0',
          'bg-white rounded-t-3xl',
          'flex flex-col',
          /*
           * 꾸미기 패널: 68dvh 고정 — 아이템 수와 무관하게 일정한 높이.
           *   계산 근거: 최소 가로모드 기기(높이 375px) 기준
           *   68dvh ≈ 255px → 헤더+탭 86px 제외 → 그리드 공간 169px
           *   480px+ 기기의 7열 2행(가장 많은 아이템인 배경 탭) = 약 150px → 여유 있음
           *   overflow-hidden 으로 스크롤바 원천 차단.
           * 나머지 패널: 85dvh 최대 (콘텐츠에 맞게 자동 확장).
           */
          active === 'dressup' ? 'h-[68dvh]' : 'max-h-[85dvh]',
          'transform transition-transform duration-300 ease-out',
          isSlideUpOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={active && active !== 'sticker' ? PANEL_TITLES[active] : undefined}
      >
        {/* 패널 헤더 — py를 줄여 콘텐츠 공간 확보 */}
        <div className="flex shrink-0 items-center justify-between px-5 py-2.5 border-b border-gray-100">
          <p className="font-black text-base text-gray-800">
            {active && active !== 'sticker' ? PANEL_TITLES[active] : ''}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 text-sm font-bold"
            aria-label="패널 닫기"
          >
            ✕
          </button>
        </div>

        {/*
         * 패널 콘텐츠:
         * - 마켓: MarketTab이 flex-1 + 내부 스크롤을 직접 관리하므로
         *         이 div도 flex-col + overflow-hidden 으로 고정합니다.
         *         overflow-y-auto 를 쓰면 이중 스크롤바가 생깁니다.
         * - 코인/꾸미기: 기존대로 overflow-y-auto 스크롤 허용
         */}
        <div className={[
          'min-h-0',
          active === 'market'
            ? 'flex-1 flex flex-col overflow-hidden'
            : 'flex-1 overflow-y-auto overscroll-contain',
        ].join(' ')}>
          {active === 'market' && (
            <MarketTab
              childId={childId}
              marketEligibleItems={marketEligibleItems}
              initialHiddenStoreItemIds={initialHiddenStoreItemIds}
              requests={marketRequests}
              creditsWallet={creditsWallet}
              initialWishlistEntries={initialWishlistEntries}
              level={level}
            />
          )}
          {active === 'coins' && features.coinPocket && (
            <CoinsPanel
              childId={childId}
              childStats={childStats}
              onStatsUpdate={onStatsUpdate}
            />
          )}
          {active === 'dressup' && (
            <DressUpPanel
              unlockedIndexes={unlockedItemIndexes}
            />
          )}
        </div>
      </div>
    </div>

    {/* ── 곰돌이 스티커판 — BearStickerSheet 자체 오버레이 (z-[100]) ── */}
    <BearStickerSheet
      open={active === 'sticker'}
      onClose={onClose}
      childId={childId}
      initialGrants={praiseGrants}
      initialPlacements={praisePlacements}
      serverPraiseBoardClearedAt={serverPraiseBoardClearedAt}
      onBoardCleared={onPraiseBoardCleared}
      praiseGrantsRevision={praiseGrantsRevision}
      onInventoryChange={onInventoryChange}
    />
    </>
  )
}

// ─── 코인 패널 ──────────────────────────────────────────────────────────────

/**
 * 코인 패널 — 돈바구니/저금통/지갑 이체 UI
 *
 * 비개발자 설명:
 * - 코인(크레딧)을 세 통(돈바구니·저금통·지갑) 사이에서 옮길 수 있습니다.
 * - 통을 탭하면 어디로 옮길지 선택할 수 있습니다.
 */
function CoinsPanel({
  childId,
  childStats,
  onStatsUpdate,
}: {
  childId: string
  childStats: ChildStats | null
  onStatsUpdate: (patch: { credits: number; credits_wallet: number; credits_piggy: number }) => void
}) {
  const [creditSheetBucket, setCreditSheetBucket] = useState<'center' | 'wallet' | 'piggy' | null>(null)
  const [creditMoveKind, setCreditMoveKind] = useState<CreditTransferKind | null>(null)

  const stNorm = childStats ? normalizeChildStatsCreditsSplit(childStats) : null
  const walletCredits = stNorm?.credits_wallet ?? 0
  const piggyCredits = stNorm?.credits_piggy ?? 0
  const floatingCredits = stNorm ? creditsFloating(stNorm) : 0

  const applyCreditTransferSuccess = useCallback(
    (result: CreditTransferApiSuccess) => {
      onStatsUpdate({
        credits: result.credits,
        credits_wallet: result.credits_wallet,
        credits_piggy: result.credits_piggy,
      })
      setCreditSheetBucket(null)
    },
    [onStatsUpdate],
  )

  /** 이동 종류별 최대 금액 */
  function maxAmountForKind(kind: CreditTransferKind): number {
    switch (kind) {
      case 'float_to_wallet':
      case 'float_to_piggy':
        return floatingCredits
      case 'wallet_to_float':
      case 'wallet_to_piggy':
        return walletCredits
      case 'piggy_to_float':
      case 'piggy_to_wallet':
        return piggyCredits
      default:
        return 0
    }
  }

  /** 코인 이동 팝업 제목 */
  const transferCopy: Record<CreditTransferKind, { title: string }> = {
    float_to_wallet: { title: '지갑으로 옮기기' },
    float_to_piggy: { title: '저금통으로 옮기기' },
    wallet_to_float: { title: '돈바구니로 꺼내기' },
    piggy_to_float: { title: '돈바구니로 꺼내기' },
    wallet_to_piggy: { title: '저금통으로 옮기기' },
    piggy_to_wallet: { title: '지갑으로 옮기기' },
  }

  return (
    <div className="p-4">
      {/* 크레딧 카드 (저금통/돈바구니/지갑) */}
      <div className="w-full max-w-[19.5rem] mx-auto">
        <MissionCreditCards
          piggy={piggyCredits}
          floating={floatingCredits}
          wallet={walletCredits}
          onPiggyTap={() => setCreditSheetBucket('piggy')}
          onCenterTap={() => { if (floatingCredits > 0) setCreditSheetBucket('center') }}
          onWalletTap={() => setCreditSheetBucket('wallet')}
        />
      </div>

      {/* 크레딧 이동 액션 시트 (어떤 방향으로?) — creditSheetBucket 이 null 이면 닫힘 */}
      {creditSheetBucket && (
        <MissionCreditActionSheet
          open={true}
          bucket={creditSheetBucket}
          floating={floatingCredits}
          wallet={walletCredits}
          piggy={piggyCredits}
          onPick={(kind) => {
            setCreditMoveKind(kind)
            setCreditSheetBucket(null)
          }}
          onClose={() => setCreditSheetBucket(null)}
        />
      )}

      {/* 크레딧 이동 다이얼로그 (수량 입력) */}
      {creditMoveKind && (
        <MissionCreditMoveDialog
          open={true}
          title={transferCopy[creditMoveKind].title}
          kind={creditMoveKind}
          maxAmount={maxAmountForKind(creditMoveKind)}
          childId={childId}
          piggyBalance={piggyCredits}
          walletBalance={walletCredits}
          onSuccess={applyCreditTransferSuccess}
          onClose={() => setCreditMoveKind(null)}
        />
      )}
    </div>
  )
}

// ─── 꾸미기 패널 ─────────────────────────────────────────────────────────────

/**
 * 꾸미기 카테고리 목록
 * - 헤어(hair) 탭은 폴더가 없으므로 제거하였습니다.
 * - id 값은 ASSETS.characters.decorItemsByCategory 의 키와 일치해야 합니다.
 */
const DECOR_CATEGORIES = [
  { id: 'cloth' as const,      label: '옷' },
  { id: 'acc' as const,        label: '악세서리' },
  { id: 'background' as const, label: '배경' },
] as const

type DecorCategoryId = (typeof DECOR_CATEGORIES)[number]['id']

/**
 * 꾸미기 패널 — 캐릭터 아이템 그리드
 *
 * 비개발자 설명:
 * - 잠금 해제된 아이템은 파란 테두리로 표시됩니다.
 * - 잠긴 아이템은 회색으로 보이며 자물쇠 아이콘이 표시됩니다.
 * - 상단 탭(옷 / 악세서리 / 배경)으로 카테고리를 전환합니다.
 */
function DressUpPanel({
  unlockedIndexes,
}: {
  unlockedIndexes: number[]
}) {
  const [activeCategory, setActiveCategory] = useState<DecorCategoryId>('cloth')

  /**
   * 현재 탭에 해당하는 아이템 목록 (폴더별 이미지 경로 + legacyIndex 포함)
   * Array<...> 로 명시해 TypeScript가 배열 길이를 고정 리터럴(5|9|13)로 추론하지 않도록 합니다.
   * 그렇지 않으면 `.length === 0` 비교에서 "no overlap" 타입 오류가 발생합니다.
   */
  const filteredItems: ReadonlyArray<{ src: string; legacyIndex: number }> =
    ASSETS.characters.decorItemsByCategory[activeCategory]

  return (
    <div className="flex flex-col min-h-0">
      {/* 카테고리 탭 */}
      <div className="flex shrink-0 flex-row justify-around border-b border-gray-100 bg-white py-2">
        {DECOR_CATEGORIES.map(({ id, label }) => {
          const isActive = activeCategory === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveCategory(id)}
              className={[
                'flex flex-col items-center gap-1 px-3 pb-1 pt-0.5 text-xs font-bold transition-colors',
                isActive
                  ? 'border-b-2 border-brand-blue text-brand-blue'
                  : 'border-b-2 border-transparent text-slate-400',
              ].join(' ')}
            >
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* 아이템 그리드 */}
      {/* overflow-hidden 으로 스크롤바를 원천 차단합니다 */}
      <div className="flex-1 overflow-hidden p-4">
        {filteredItems.length === 0 ? (
          <p className="pt-8 text-center text-sm text-gray-400">아이템이 없어요</p>
        ) : (
          <div className="grid grid-cols-5 min-[480px]:grid-cols-7 lg:grid-cols-9 gap-1.5">
            {filteredItems.map(({ src, legacyIndex }) => {
              const owned = unlockedIndexes.includes(legacyIndex)
              return (
                <div
                  key={legacyIndex}
                  className={[
                    'relative overflow-hidden rounded-lg border bg-white',
                    owned ? 'border-brand-blue ring-2 ring-brand-blue/30' : 'border-gray-100',
                  ].join(' ')}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={src}
                      alt=""
                      fill
                      loading="lazy"
                      sizes="(min-width: 1024px) 9vw, (min-width: 480px) 12vw, 15vw"
                      className={`object-contain p-1 ${owned ? '' : 'grayscale opacity-60'}`}
                      draggable={false}
                    />
                    {!owned && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                        <svg className="h-4 w-4 text-white drop-shadow" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <rect x="4" y="11" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                          <circle cx="12" cy="16" r="1.25" fill="currentColor" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 스티커 패널 ─────────────────────────────────────────────────────────────

/**
 * 스티커 썸네일 — sprite_key 로 이미지 URL을 결정합니다.
 */
function StickerThumb({ spriteKey, size = 32 }: { spriteKey: string; size?: number }) {
  const assetSrc = praiseAssetStickerUrl(spriteKey)
  if (assetSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={assetSrc}
        alt=""
        width={size}
        height={size}
        className="object-contain select-none"
        style={{ width: size, height: size }}
      />
    )
  }
  const ui = praiseUiKindFromSpriteKey(spriteKey)
  if (ui) return <PraiseUiIcon kind={ui} size={size} />
  return <span className="text-xl" role="img" aria-label={spriteKey}>⭐</span>
}

/**
 * 탭 배치 스티커 패널
 *
 * 비개발자 설명:
 * 1단계: 하단 인벤토리에서 스티커를 탭 → 파란 링으로 선택 표시
 * 2단계: 보드의 빈 칸을 탭 → 스티커가 쏙 들어감
 * 선택된 스티커를 다시 탭하면 선택 취소
 */
function TapStickerPanel({
  childId,
  praiseGrants,
  praisePlacements,
  serverPraiseBoardClearedAt,
  onBoardCleared,
  onInventoryChange,
}: {
  childId: string
  praiseGrants: PraiseStickerGrant[]
  praisePlacements: PraiseStickerPlacement[]
  serverPraiseBoardClearedAt: string | null
  onBoardCleared: (clearedAt?: string, meta?: { grantsDeleted?: boolean }) => void
  onInventoryChange: () => void
}) {
  /** 인벤토리에서 선택한 grant ID */
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null)
  /** API 호출 중 중복 방지 */
  const [placing, setPlacing] = useState(false)
  /** 방금 배치된 슬롯 번호 (팝 애니메이션용) */
  const [poppingSlot, setPoppingSlot] = useState<number | null>(null)
  /** 낙관적 업데이트용 로컬 배치 목록 */
  const [localPlacements, setLocalPlacements] = useState<PraiseStickerPlacement[]>(praisePlacements)

  useEffect(() => {
    setLocalPlacements(praisePlacements)
  }, [praisePlacements])

  /** 배치 완료된 grant ID 집합 */
  const placedGrantIds = new Set(localPlacements.map((p) => p.grant_id))

  /** 아직 배치되지 않은 스티커 목록 */
  const unplacedGrants = praiseGrants.filter((g) => {
    if (placedGrantIds.has(g.id)) return false
    if (serverPraiseBoardClearedAt && g.created_at <= serverPraiseBoardClearedAt) return false
    return true
  })

  /** grant ID → PraiseStickerGrant 빠른 조회 */
  const grantById = new Map(praiseGrants.map((g) => [g.id, g]))

  /** 슬롯 번호 → 배치된 placement */
  const slotMap = new Map<number, PraiseStickerPlacement>()
  for (const p of localPlacements) {
    if (p.board_slot != null) slotMap.set(p.board_slot, p)
  }

  /**
   * 인벤토리 스티커 탭 — 선택/선택 취소 토글
   */
  function handleGrantTap(grantId: string) {
    setSelectedGrantId((prev) => (prev === grantId ? null : grantId))
  }

  /**
   * 보드 슬롯 탭 — 선택된 스티커를 해당 칸에 배치
   */
  async function handleSlotTap(slot: number) {
    if (placing || slotMap.has(slot) || !selectedGrantId) return
    const center = slotCenterPercent(slot)
    if (!center) return

    setPlacing(true)
    setPoppingSlot(slot)
    const grantId = selectedGrantId
    setSelectedGrantId(null)

    /** 낙관적 업데이트: 즉시 화면에 표시 */
    const tempId = `temp_${Date.now()}`
    const tempPlacement: PraiseStickerPlacement = {
      id: tempId,
      child_id: childId,
      grant_id: grantId,
      board_slot: slot,
      x_ratio: center.x / 100,
      y_ratio: center.y / 100,
      scale_ratio: 1,
      created_at: new Date().toISOString(),
    }
    setLocalPlacements((prev) => [...prev, tempPlacement])
    setTimeout(() => setPoppingSlot(null), 400)

    try {
      const res = await fetch('/api/praise-sticker/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          grantId,
          boardSlot: slot,
          xRatio: center.x / 100,
          yRatio: center.y / 100,
          scaleRatio: 1,
        }),
      })
      if (!res.ok) {
        /** 실패 시 낙관적 업데이트 롤백 */
        setLocalPlacements((prev) => prev.filter((p) => p.id !== tempId))
      } else {
        onInventoryChange()
      }
    } catch {
      setLocalPlacements((prev) => prev.filter((p) => p.id !== tempId))
    } finally {
      setPlacing(false)
    }
  }

  const SLOT_TOTAL = 20

  return (
    <div className="flex flex-col p-4 gap-4">

      {/* ── 인벤토리 안내 ── */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-700">받은 스티커</span>
        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-black text-yellow-700">
          {unplacedGrants.length}개
        </span>
        {selectedGrantId ? (
          <span className="text-xs text-blue-500 font-medium">빈 칸을 탭해서 붙여요!</span>
        ) : unplacedGrants.length > 0 ? (
          <span className="text-xs text-gray-400">스티커를 탭해서 선택하세요</span>
        ) : null}
      </div>

      {/* ── 인벤토리 (가로 스크롤) ── */}
      {unplacedGrants.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {unplacedGrants.map((g) => {
            const isSelected = selectedGrantId === g.id
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => handleGrantTap(g.id)}
                className={[
                  'shrink-0 flex items-center justify-center w-[52px] h-[52px] rounded-2xl border-2 bg-white shadow-sm transition-all duration-150 active:scale-95',
                  isSelected
                    ? 'border-blue-400 ring-2 ring-blue-300 scale-110 shadow-md'
                    : 'border-gray-200 hover:border-blue-200',
                ].join(' ')}
                aria-label={`스티커 선택`}
                aria-pressed={isSelected}
              >
                <StickerThumb spriteKey={g.sprite_key} size={36} />
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-gray-400 py-2">
          아직 받은 칭찬 스티커가 없어요
        </p>
      )}

      {/* ── 스티커 보드 (4×5 그리드) ── */}
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: SLOT_TOTAL }, (_, i) => i + 1).map((slot) => {
          const placement = slotMap.get(slot)
          const grant = placement ? grantById.get(placement.grant_id) : null
          const isEmpty = !placement
          const isPopping = poppingSlot === slot
          const canPlace = isEmpty && !!selectedGrantId && !placing

          return (
            <button
              key={slot}
              type="button"
              disabled={!isEmpty || placing}
              onClick={() => handleSlotTap(slot)}
              className={[
                'relative flex aspect-square items-center justify-center rounded-2xl border-2 transition-all duration-200',
                isEmpty
                  ? canPlace
                    ? 'border-dashed border-blue-400 bg-blue-50 hover:bg-blue-100 cursor-pointer active:scale-95'
                    : 'border-dashed border-gray-200 bg-gray-50 cursor-default'
                  : 'border-solid border-green-200 bg-green-50 cursor-default',
              ].join(' ')}
              aria-label={isEmpty ? `${slot}번 칸` : `${slot}번 칸 (스티커 배치됨)`}
            >
              {/* 슬롯 번호 */}
              {isEmpty && (
                <span className="absolute top-1 left-1.5 text-[9px] font-bold text-gray-300 select-none">
                  {slot}
                </span>
              )}

              {/* 배치된 스티커 */}
              {placement && (
                <span
                  className={[
                    'absolute left-1/2 top-1/2',
                    isPopping
                      ? 'animate-[stickerPop_0.3s_cubic-bezier(0.34,1.56,0.64,1)_forwards]'
                      : '-translate-x-1/2 -translate-y-1/2',
                  ].join(' ')}
                >
                  {grant ? (
                    <StickerThumb spriteKey={grant.sprite_key} size={34} />
                  ) : (
                    <span className="text-lg">⭐</span>
                  )}
                </span>
              )}

              {/* 빈 칸 + 아이콘 */}
              {isEmpty && !canPlace && (
                <span className="text-gray-200 text-sm select-none">+</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

