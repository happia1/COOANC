'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import type { StoreItem, PurchaseRequest } from '@/types/database'
import SpriteImage from '@/components/common/SpriteImage'
import StoreItemThumbnail from '@/components/common/StoreItemThumbnail'
import { SHOP_ANIMATIONS, ICONS } from '@/constants/sprites'
import MarketPurchaseConfirmDialog from '@/components/child/MarketPurchaseConfirmDialog'
import MarketPurchaseSuccessOverlay from '@/components/child/MarketPurchaseSuccessOverlay'
import MarketRequestsBottomSheet from '@/components/child/MarketRequestsBottomSheet'
import MarketWishlistBottomSheet from '@/components/child/MarketWishlistBottomSheet'
import { marketFrameKeyForItemId, type MarketItemFrameKey } from '@/lib/marketItemFrame'
import { formatMarketCreditLabel } from '@/lib/applyStoreItemCreditOverrides'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { walletImageSrcByStage, walletStageIndexByCredits } from '@/lib/walletStages'
import {
  PARENT_MARKET_MENU_SECTIONS,
  parentMarketSectionIdForItem,
  type ParentMarketSectionId,
} from '@/lib/parentMarketMenuSections'

type Props = {
  childId: string
  /**
   * 가족 기준으로 볼 수 있는 전체 마켓 상품(부모 숨김 적용 전).
   * 숨김은 `initialHiddenStoreItemIds` + 실시간 DB 이벤트로 클라이언트에서 반영합니다.
   */
  marketEligibleItems: StoreItem[]
  /** 서버에서 읽은 숨김 상품 id — 탭에서 주기적으로 다시 읽어 반영합니다 */
  initialHiddenStoreItemIds: string[]
  requests: PurchaseRequest[]
  /** 마켓 결제에 쓰는 지갑 크레딧(돈바구니·저금통에 둔 것 제외) */
  creditsWallet: number
  /** 장바구니(서버 `market_wishlist_items`) 초기 목록(상품별 수량 포함) */
  initialWishlistEntries: { storeItemId: string; quantity: number }[]
  level: number
}

type SelectedInfo = {
  item: StoreItem
  frame: MarketItemFrameKey
}

/** 배달 연출 단계: 배송 출발 안내 → 낙하산 도착 연출 */
type DeliveryPhase = 'shipping' | 'parachute'

type DeliveryOverlay = {
  request: PurchaseRequest
  frame: MarketItemFrameKey
  /** 같은 상품의 `store_items.image_url` — 있으면 연출에도 실제 사진을 씀 */
  itemImageUrl: string | null
  phase: DeliveryPhase
}

/**
 * 마켓 상단 지붕 PNG(`public/.../market_roof.png`)를 **파일 이름은 그대로** 두고 내용만 바꿀 때,
 * 브라우저·중간 캐시가 예전 그림을 계속 보여 줄 수 있어요. 그때마다 아래 숫자만 1 올리면
 * 주소가 달라져서 새 이미지를 다시 받아옵니다.
 */
const MARKET_ROOF_CACHE_BUST = 2
/** 실제 표시 URL — `/public` 기준 정적 경로 + 캐시 끊기용 쿼리 */
const ROOF_SRC = `/assets/img/layouts/backgrounds/market_roof.png?v=${MARKET_ROOF_CACHE_BUST}`
/** 요청사항: 물건이 담긴 장바구니 아이콘(공용 정적 이미지) */
const BASKET_FILLED_SRC = '/assets/img/common/ui/basket_filled.png'

/** 선반 3단을 한 화면에 넣기 위한 카드·썸네일 크기(가로 스크롤 행 안에서 사용) */
const SHELF_IMG_AREA_PX = 52
const SHELF_SPRITE_H = 44

/**
 * 배달 풀스크린 연출(「배달 시작」→「상품이 도착했어요」→「받았어요」)을 켜거나 끕니다.
 * false 이면 연출·버튼이 안 뜹니다. 이미 `approved` 인 건은 목록에 「배송 중」으로만 보이며,
 * 다시 true 로 켠 뒤에야 「받았어요」로 배송 완료 처리를 할 수 있습니다.
 */
const MARKET_DELIVERY_OVERLAY_ENABLED = false

/** 구매 요청 시 부모 승인 탭 카드에 `child_message` 로 저장되는 안내 문구 */
const MARKET_REQUEST_PARENT_NOTICE =
  '마켓에서 크레딧으로 이 상품 구매를 요청했어요. 확인 후 승인 부탁드려요!'

/**
 * 선반에서 같은 상품을 중복 요청하지 못하게 막는 상태
 * - pending / parent_buying: 아직 진행 중이므로 재요청 차단
 * - approved: 이미 승인된 과거 요청이 남아 있어도 다시 구매할 수 있어야 하므로 차단에서 제외
 */
const SHELF_BLOCK_STATUSES: PurchaseRequest['status'][] = ['pending', 'parent_buying']

export default function MarketTab({
  childId,
  marketEligibleItems,
  initialHiddenStoreItemIds,
  requests,
  creditsWallet,
  initialWishlistEntries,
  level,
}: Props) {
  const [currentWallet, setCurrentWallet] = useState(creditsWallet)
  /**
   * 마켓탭 지갑도 미션탭과 같이 9단계 PNG를 쓰고, 잔액 변화 시 한 단계씩 따라가게 합니다.
   */
  const walletTargetIdx = walletStageIndexByCredits(currentWallet)
  const [animatedWalletIdx, setAnimatedWalletIdx] = useState(walletTargetIdx)
  const animatedWalletIdxRef = useRef(animatedWalletIdx)
  /** 상품별 장바구니 수량(1 이상) */
  const [wishlistQuantities, setWishlistQuantities] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {}
    for (const e of initialWishlistEntries) {
      if (e.quantity > 0) base[e.storeItemId] = e.quantity
    }
    return base
  })
  const [myRequests, setMyRequests] = useState<PurchaseRequest[]>(requests)
  /** 부모가 마켓에서 숨긴 상품 id — INSERT 되면 추가, DELETE 되면 제거(자녀 화면에 곧바로 반영) */
  const [hiddenStoreItemIds, setHiddenStoreItemIds] = useState<string[]>(() =>
    [...initialHiddenStoreItemIds].sort(),
  )
  /** 서버가 다시 내려줄 때(탭 재진입 등) 숨김 목록을 초기값과 맞춤 — 내용 문자열만 비교 */
  const hiddenBootstrapKey = useMemo(
    () => `${childId}|${[...initialHiddenStoreItemIds].sort().join('|')}`,
    [childId, initialHiddenStoreItemIds],
  )
  // 서버 스냅샷이 바뀐 경우에만(키 문자열로 구분) — 배열 참조만 다른 재렌더에서는 실시간 상태를 덮어쓰지 않음
  useEffect(() => {
    setHiddenStoreItemIds([...initialHiddenStoreItemIds].sort())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialHiddenStoreItemIds 는 hiddenBootstrapKey 에 반영됨
  }, [hiddenBootstrapKey])

  useEffect(() => {
    animatedWalletIdxRef.current = animatedWalletIdx
  }, [animatedWalletIdx])

  useEffect(() => {
    if (walletTargetIdx === animatedWalletIdxRef.current) return
    /** 목표 단계까지 1칸씩 이동해 지갑 이미지가 자연스럽게 바뀌게 합니다. */
    const tick = setInterval(() => {
      setAnimatedWalletIdx((prev) => {
        if (prev === walletTargetIdx) return prev
        return prev + (walletTargetIdx > prev ? 1 : -1)
      })
    }, 160)
    return () => clearInterval(tick)
  }, [walletTargetIdx])

  const wishlistBootstrapKey = useMemo(
    () =>
      `${childId}|${[...initialWishlistEntries]
        .sort((a, b) => a.storeItemId.localeCompare(b.storeItemId))
        .map((e) => `${e.storeItemId}:${e.quantity}`)
        .join('|')}`,
    [childId, initialWishlistEntries],
  )
  useEffect(() => {
    const next: Record<string, number> = {}
    for (const e of initialWishlistEntries) {
      if (e.quantity > 0) next[e.storeItemId] = e.quantity
    }
    setWishlistQuantities(next)
  }, [wishlistBootstrapKey, initialWishlistEntries])

  useEffect(() => {
    setCurrentWallet(creditsWallet)
  }, [creditsWallet])

  /** 장바구니가 비면 열린 시트를 자동으로 닫아 빈 화면을 막음 */
  useEffect(() => {
    if (Object.keys(wishlistQuantities).length === 0) setWishlistSheetOpen(false)
  }, [wishlistQuantities])

  /** 숨김을 제외한 실제 선반에 올릴 상품 */
  const visibleItems = useMemo(() => {
    const hidden = new Set(hiddenStoreItemIds)
    return marketEligibleItems.filter((item) => !hidden.has(item.id))
  }, [marketEligibleItems, hiddenStoreItemIds])

  /**
   * 부모 「메뉴 제어」와 같은 순서(간식 → 장난감 → 이벤트 → 기타)로 구역을 나눕니다.
   * digital(캐릭터 꾸미기) 상품은 페이지에서 걸러져 오지 않습니다.
   */
  const marketSectionsWithShelves = useMemo(() => {
    const buckets: Record<ParentMarketSectionId, StoreItem[]> = {
      snack: [],
      toy: [],
      event: [],
      other: [],
    }
    for (const item of visibleItems) {
      buckets[parentMarketSectionIdForItem(item.category)].push(item)
    }
    const sortInSection = (a: StoreItem, b: StoreItem) =>
      a.credit_price !== b.credit_price
        ? a.credit_price - b.credit_price
        : a.name.localeCompare(b.name, 'ko')
    for (const id of Object.keys(buckets) as ParentMarketSectionId[]) {
      buckets[id].sort(sortInSection)
    }
    type Block = {
      sectionKey: ParentMarketSectionId
      title: string
      items: StoreItem[]
    }
    const sections: Block[] = []
    /**
     * 요청사항: 자녀 마켓 선반 순서를 고정
     * 1) 이벤트 2) 간식 3) 장난감
     */
    const sectionMetaById: Record<ParentMarketSectionId, { title: string }> = {
      snack: { title: '간식' },
      toy: { title: '장난감' },
      event: { title: '이벤트' },
      other: { title: '기타' },
    }
    const ordered: ParentMarketSectionId[] = ['event', 'snack', 'toy']
    for (const id of ordered) {
      const items = buckets[id]
      if (items.length === 0) continue
      sections.push({
        sectionKey: id,
        title: sectionMetaById[id].title,
        items,
      })
    }
    if (buckets.other.length > 0) {
      sections.push({
        sectionKey: 'other',
        title: '기타',
        items: buckets.other,
      })
    }
    return sections
  }, [visibleItems])

  /** 노출 중인 상품 중 크레딧이 가장 비싼 칸에 BEST 뱃지 */
  const bestItemId = useMemo(
    () =>
      visibleItems.reduce<string | null>((best, item) => {
        if (!best) return item.id
        const bestItem = visibleItems.find((i) => i.id === best)!
        return item.credit_price > bestItem.credit_price ? item.id : best
      }, null),
    [visibleItems],
  )

  const wishlistItemIds = useMemo(() => Object.keys(wishlistQuantities), [wishlistQuantities])
  const wishlistItemsResolved = useMemo(
    () => marketEligibleItems.filter((i) => wishlistItemIds.includes(i.id)),
    [marketEligibleItems, wishlistItemIds],
  )
  const wishlistEntriesResolved = useMemo(
    () =>
      wishlistItemsResolved.map((item) => ({
        item,
        quantity: wishlistQuantities[item.id] ?? 1,
      })),
    [wishlistItemsResolved, wishlistQuantities],
  )
  const wishlistTotalCredits = useMemo(
    () => wishlistEntriesResolved.reduce((acc, e) => acc + e.item.credit_price * e.quantity, 0),
    [wishlistEntriesResolved],
  )
  const wishlistTotalCount = useMemo(
    () => wishlistEntriesResolved.reduce((acc, e) => acc + e.quantity, 0),
    [wishlistEntriesResolved],
  )
  const wishlistShortage = Math.max(0, wishlistTotalCredits - currentWallet)

  const shelfBlockedItemIds = useMemo(() => {
    const s = new Set<string>()
    for (const r of myRequests) {
      if (r.item_id && SHELF_BLOCK_STATUSES.includes(r.status)) s.add(r.item_id)
    }
    return s
  }, [myRequests])

  /** 부모가 「상품 구매하기」를 눌렀을 때 — 외부 주문 안내 */
  const [parentShopNoticeOpen, setParentShopNoticeOpen] = useState(false)
  const [requestsSheetOpen, setRequestsSheetOpen] = useState(false)
  /** 장바구니 요약·미션 이동은 플로팅 버튼 → 슬라이딩 시트로만 노출 */
  const [wishlistSheetOpen, setWishlistSheetOpen] = useState(false)
  /** 선반에서 「장바구니」로 담은 직후 — 바구니 그림 + 「보러가기」 안내 팝업 */
  const [wishlistAddedNoticeOpen, setWishlistAddedNoticeOpen] = useState(false)
  const [purchaseCelebrationOpen, setPurchaseCelebrationOpen] = useState(false)

  const dismissPurchaseCelebration = useCallback(() => setPurchaseCelebrationOpen(false), [])

  const hasActiveRequestPipeline = useMemo(
    () =>
      myRequests.some((r) =>
        r.status === 'pending' || r.status === 'parent_buying' || r.status === 'approved',
      ),
    [myRequests],
  )

  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [selected, setSelected] = useState<SelectedInfo | null>(null)
  /** 선반 카드 탭 시 — 구매 / 장바구니 담기 를 고르는 하단 액션 시트 */
  const [shelfActionFor, setShelfActionFor] = useState<SelectedInfo | null>(null)
  const [delivery, setDelivery] = useState<DeliveryOverlay | null>(null)
  /** 배달 연출이 끝난 뒤 「받았어요」 버튼을 잠깐 뒤에 보여 줍니다 */
  const [showReceiveBtn, setShowReceiveBtn] = useState(false)
  /** 승인된 요청이 연속으로 올 때, 한 건씩만 연출하고 나머지는 줄을 섭니다 */
  const deliveryWaitRef = useRef<PurchaseRequest[]>([])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const dismissPurchaseDialog = useCallback(() => setSelected(null), [])

  const [wishBusy, setWishBusy] = useState<string | null>(null)

  /** 장바구니 담기(+1) — 성공 시 true */
  const addWishlistOne = useCallback(
    async (storeItemId: string): Promise<boolean> => {
      if (wishBusy) return false
      setWishBusy(storeItemId)
      try {
        const res = await fetch('/api/market/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', storeItemId, childId }),
        })
        const text = await res.text()
        const json = text ? JSON.parse(text) : {}
        if (!res.ok) {
          showToast(typeof json.error === 'string' ? json.error : '처리에 실패했어요', false)
          return false
        }
        setWishlistQuantities((prev) => {
          const nextQty = typeof json.quantity === 'number' && json.quantity > 0 ? json.quantity : (prev[storeItemId] ?? 0) + 1
          return { ...prev, [storeItemId]: nextQty }
        })
        return true
      } catch {
        showToast('네트워크 오류가 났어요', false)
        return false
      } finally {
        setWishBusy(null)
      }
    },
    [childId, wishBusy],
  )

  /** 장바구니에서 상품 삭제(X) */
  const removeWishlistItem = useCallback(
    async (storeItemId: string): Promise<boolean> => {
      if (wishBusy) return false
      setWishBusy(storeItemId)
      try {
        const res = await fetch('/api/market/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'remove', storeItemId, childId }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(typeof json.error === 'string' ? json.error : '삭제에 실패했어요', false)
          return false
        }
        setWishlistQuantities((prev) => {
          const copy = { ...prev }
          delete copy[storeItemId]
          return copy
        })
        return true
      } catch {
        showToast('네트워크 오류가 났어요', false)
        return false
      } finally {
        setWishBusy(null)
      }
    },
    [childId, wishBusy],
  )

  /** 장바구니 수량 변경(+/-) */
  const updateWishlistQuantity = useCallback(
    async (storeItemId: string, quantity: number): Promise<boolean> => {
      if (wishBusy) return false
      if (quantity < 1) return removeWishlistItem(storeItemId)
      setWishBusy(storeItemId)
      try {
        const res = await fetch('/api/market/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_quantity', storeItemId, quantity, childId }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(typeof json.error === 'string' ? json.error : '수량 변경에 실패했어요', false)
          return false
        }
        setWishlistQuantities((prev) => ({
          ...prev,
          [storeItemId]:
            typeof json.quantity === 'number' && json.quantity > 0 ? json.quantity : quantity,
        }))
        if (json.degraded === true) {
          // quantity 컬럼 없는 구버전 DB 에서는 현재 세션 기준 수량으로 동작함을 안내
          showToast('수량이 반영됐어요')
        }
        return true
      } catch {
        showToast('네트워크 오류가 났어요', false)
        return false
      } finally {
        setWishBusy(null)
      }
    },
    [childId, wishBusy, removeWishlistItem],
  )

  /** API 성공 후 확인 팝업이 닫힌 뒤 축하 연출(콘페티·낙하산) */
  const onPurchaseDialogSuccessDismiss = useCallback(() => {
    setSelected(null)
    setPurchaseCelebrationOpen(true)
  }, [])

  /** 다음 배달 연출을 꺼내거나, 대기 줄에 넣습니다 */
  const offerDelivery = useCallback(
    (req: PurchaseRequest) => {
      if (!MARKET_DELIVERY_OVERLAY_ENABLED) return
      if (req.status !== 'approved') return
      const linked = req.item_id ? marketEligibleItems.find((i) => i.id === req.item_id) : undefined
      const itemImageUrl = linked?.image_url ?? null
      setDelivery((cur) => {
        if (!cur) {
          return {
            request: req,
            frame: marketFrameKeyForItemId(req.item_id, req.item_name),
            itemImageUrl,
            phase: 'shipping',
          }
        }
        deliveryWaitRef.current.push(req)
        return cur
      })
    },
    [marketEligibleItems],
  )

  /** 연출 종료 후 대기 중인 다음 요청이 있으면 이어서 재생합니다 */
  const finishDeliveryAndDequeue = useCallback(() => {
    setDelivery(null)
    setShowReceiveBtn(false)
    const next = deliveryWaitRef.current.shift()
    if (next) {
      window.setTimeout(() => {
        offerDelivery(next)
      }, 80)
    }
  }, [offerDelivery])

  /** 부모가 승인하면 배달 연출 큐에 넣음(연출 플래그가 켜져 있을 때만) */
  const onRequestApproved = useCallback(
    (req: PurchaseRequest) => {
      offerDelivery(req)
    },
    [offerDelivery],
  )

  /**
   * 첫 진입 시 이미 「승인」된 요청이 있으면 순서대로 연출합니다.
   * 동시에 여러 건이 있으면 첫 건만 바로 재생하고 나머지는 대기 줄에 넣습니다(상태 배치 충돌 방지).
   */
  useEffect(() => {
    if (!MARKET_DELIVERY_OVERLAY_ENABLED) return

    const approved = requests
      .filter((r) => r.status === 'approved')
      .sort((a, b) => (a.approved_at ?? '').localeCompare(b.approved_at ?? ''))
    if (approved.length === 0) return
    deliveryWaitRef.current.push(...approved.slice(1))
    offerDelivery(approved[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 props 기준 한 번만 자동 재생
  }, [])

  /**
   * WebSocket(Realtime) 대신 주기적 일반 조회로 숨김·구매 요청·지갑 잔액을 맞춥니다.
   * (비개발자용) 부모가 설정을 바꿔도 최대 몇 초 안에 자녀 화면이 따라갑니다.
   */
  const prevPurchaseRequestsRef = useRef<PurchaseRequest[]>(requests)

  useEffect(() => {
    let cancelled = false

    /**
     * Supabase JS 가 브라우저에서 직접 REST 를 부를 때(anon + RLS) 환경에 따라 400 이 난 경우가 있어,
     * 동일 쿼리를 서버 라우트(`/api/market/child-sync`)에서 실행합니다 — 쿠키 세션과 `resolveApiActorChildId` 로 child_id 를 고릅니다.
     */
    const syncMarketFromDb = async () => {
      try {
        const res = await fetch(
          `/api/market/child-sync?childId=${encodeURIComponent(childId)}`,
          { credentials: 'same-origin' },
        )
        if (cancelled) return
        if (!res.ok) {
          console.warn('[MarketTab] child-sync HTTP', res.status, await res.text().catch(() => ''))
          return
        }
        const json = (await res.json()) as {
          hiddenStoreItemIds: string[]
          purchaseRequests: PurchaseRequest[]
          creditsWallet: number | null
          partial?: boolean
        }
        setHiddenStoreItemIds([...json.hiddenStoreItemIds].sort())
        if (json.creditsWallet !== null && json.creditsWallet !== undefined) {
          setCurrentWallet(json.creditsWallet)
        }
        const next = json.purchaseRequests
        const prev = prevPurchaseRequestsRef.current
        for (const row of next) {
          const old = prev.find((p) => p.id === row.id)
          if (row.status === 'approved' && (old?.status === 'pending' || old?.status === 'parent_buying')) {
            onRequestApproved(row)
          }
          if (row.status === 'parent_buying' && old?.status === 'pending') {
            setParentShopNoticeOpen(true)
          }
          if (row.status === 'rejected' && (old?.status === 'pending' || old?.status === 'parent_buying')) {
            setCurrentWallet((w) => w + row.item_price)
          }
        }
        prevPurchaseRequestsRef.current = next
        setMyRequests(next)
      } catch (e) {
        console.warn('[MarketTab] child-sync', e)
      }
    }

    void syncMarketFromDb()
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncMarketFromDb()
    }, 5000)
    const onVisibleOrFocus = () => {
      if (document.visibilityState === 'visible') void syncMarketFromDb()
    }
    document.addEventListener('visibilitychange', onVisibleOrFocus)
    window.addEventListener('focus', onVisibleOrFocus)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibleOrFocus)
      window.removeEventListener('focus', onVisibleOrFocus)
    }
  }, [childId, onRequestApproved])

  /** 「배송 중」단계가 잠시 지나면 낙하산 도착 단계로 넘깁니다 */
  useEffect(() => {
    if (!MARKET_DELIVERY_OVERLAY_ENABLED) return
    if (!delivery || delivery.phase !== 'shipping') return
    const t = window.setTimeout(() => {
      setDelivery((d) => (d && d.request.id === delivery.request.id ? { ...d, phase: 'parachute' } : d))
    }, 3200)
    return () => window.clearTimeout(t)
  }, [delivery])

  /** 낙하산 단계에서 버튼은 애니메이션이 거의 끝난 뒤에 표시합니다 */
  useEffect(() => {
    if (!MARKET_DELIVERY_OVERLAY_ENABLED) return
    if (!delivery || delivery.phase !== 'parachute') {
      setShowReceiveBtn(false)
      return
    }
    const t = window.setTimeout(() => setShowReceiveBtn(true), 2400)
    return () => window.clearTimeout(t)
  }, [delivery])

  /** 카드 탭: 바로 구매 확인으로 가지 않고, 먼저 「구매 / 장바구니」액션 시트를 띄웁니다 */
  function handleItemClick(item: StoreItem, frame: MarketItemFrameKey) {
    if (loading) {
      return
    }
    setShelfActionFor({ item, frame })
  }

  const dismissShelfAction = useCallback(() => setShelfActionFor(null), [])

  /** 액션 시트에서 「구매」— 잔액·레벨이 될 때만 구매 확인 다이얼로그로 넘깁니다 */
  const openPurchaseFromShelfAction = useCallback(() => {
    if (!shelfActionFor) return
    const { item, frame } = shelfActionFor
    if (currentWallet < item.credit_price || level < item.level_required) return
    setShelfActionFor(null)
    setSelected({ item, frame })
  }, [shelfActionFor, currentWallet, level])

  /** 액션 시트에서 장바구니 담기/빼기 */
  const cartFromShelfAction = useCallback(async () => {
    if (!shelfActionFor) return
    const id = shelfActionFor.item.id
    const ok = await addWishlistOne(id)
    if (ok) {
      dismissShelfAction()
      // 토스트 대신 전용 팝업(바구니 그림 + 장바구니 시트로 이동 버튼)을 띄웁니다
      setWishlistAddedNoticeOpen(true)
    }
  }, [shelfActionFor, addWishlistOne, dismissShelfAction])

  /** 액션 시트에 쓰는 구매 가능 여부·안내 문구(카드 탭 시점의 상품 기준) */
  const shelfActionBuyMeta = useMemo(() => {
    if (!shelfActionFor) return null
    const it = shelfActionFor.item
    const levelOk = level >= it.level_required
    const affordOk = currentWallet >= it.credit_price
    return {
      it,
      canBuy: levelOk && affordOk,
      levelOk,
      affordOk,
    }
  }, [shelfActionFor, level, currentWallet])

  /** 구매 요청 API — 성공 시 다이얼로그가 바로 닫힘 */
  async function submitPurchaseRequest(): Promise<boolean> {
    if (!selected) return false
    const { item } = selected
    setLoading(item.id)
    try {
      const res = await fetch('/api/market/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          childId,
          childMessage: MARKET_REQUEST_PARENT_NOTICE,
        }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        showToast(json.error ?? '요청에 실패했어요', false)
        return false
      }
      if ('credits_wallet' in json) setCurrentWallet(readChildStatInt(json.credits_wallet))
      else setCurrentWallet((w) => w - item.credit_price)
      if (json.request) setMyRequests((prev) => [json.request as PurchaseRequest, ...prev])
      /** 축하 오버레이에서 안내하므로 별도 토스트는 띄우지 않음(문구 겹침 방지) */
      return true
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
      return false
    } finally {
      setLoading(null)
    }
  }

  async function completeDeliveryFlow() {
    if (!delivery) return
    setLoading('delivery')
    try {
      const res = await fetch('/api/market/complete-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /** 부모 미리보기 시에도 완료 API가 올바른 자녀 행을 찾도록 페이지와 같은 childId 를 넘깁니다 */
        body: JSON.stringify({ requestId: delivery.request.id, childId }),
      })
      const text = await res.text()
      let json: { error?: string } = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        showToast('네트워크 오류가 발생했어요', false)
        return
      }
      if (!res.ok) {
        showToast(json.error ?? '완료 처리에 실패했어요', false)
        return
      }
      const id = delivery.request.id
      setMyRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: 'delivered' as const, delivered_at: new Date().toISOString() } : r,
        ),
      )
      showToast('상품을 받았어요!')
      finishDeliveryAndDequeue()
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(null)
    }
  }

  /**
   * 마켓 본문: 지붕은 고정(shrink-0), 선반은 세로 스크롤(flex-1), 크레딧은 하단 고정 바(지갑·동전·숫자).
   * 스프라이트는 `public/assets/img/common/ui/icons.png`(상수 `ICONS`)를 사용합니다.
   */
  return (
    <div
      className="-mx-4 -mt-4 flex min-h-0 flex-1 flex-col overflow-hidden pb-0"
      style={{ background: '#FAF5EF' }}
    >

      {/**
       * 자녀 레이아웃 `main`은 z-10 이라, 여기서 `fixed top-6` 토스트는 상단바(z-40)에 가려질 수 있습니다.
       * `body` 포털 + 화면 중앙으로 옮겨 항상 읽을 수 있게 합니다.
       */}
      {toast &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center px-5 pointer-events-none"
            role="status"
            aria-live="polite"
          >
            <div
              className={`max-w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl px-5 py-3 text-center text-sm font-bold leading-snug text-white shadow-2xl ring-2 ring-white/25 pointer-events-auto ${
                toast.ok ? 'bg-brand-blue' : 'bg-red-500'
              }`}
            >
              {toast.msg}
            </div>
          </div>,
          document.body,
        )}

      {/* 가게 지붕: LCP 후보 — priority + sizes 로 첫 페인트에 맞는 해상도만 받습니다 */}
      <div className="shrink-0 w-full overflow-hidden leading-none">
        <Image
          src={ROOF_SRC}
          alt=""
          width={1200}
          height={180}
          priority
          sizes="100vw"
          className="block h-auto w-full max-h-[4.5rem] select-none object-cover object-bottom sm:max-h-[5rem]"
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>

      {visibleItems.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-8">
          <SpriteImage sheet={ICONS} frame="market" width={56} />
          <p className="font-bold text-brand-text">아직 상품이 없어요</p>
          <p className="text-sm text-gray-400">부모님이 상품을 추가해주실 거예요!</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2 [scrollbar-width:thin]">
          {/* 요청사항: 이벤트 → 간식 → 장난감 3단 선반을 동시에 노출 */}
          {marketSectionsWithShelves.map((block, blockIdx) => (
            <section key={block.sectionKey} className="shrink-0">
              <h3 className="mb-1.5 flex items-center gap-1.5 border-b border-amber-900/10 px-2 pb-1 text-[11px] font-black tracking-tight text-amber-950/90">
                {block.title}
                <span className="ml-auto tabular-nums text-[9px] font-bold text-amber-900/40">{block.items.length}개</span>
              </h3>
              {/* 선반 내부만 좌우 슬라이드 */}
              <div className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 py-0.5 [-ms-overflow-style:none] [scrollbar-width:none]">
                {block.items.map((item, itemIdx) => {
                  const frameKey = marketFrameKeyForItemId(item.id, item.name)
                  /** 첫 구역 맨 앞 몇 칸만 우선 로드 — 나머지는 지연 로드로 대역폭 절약 */
                  const thumbPriority = blockIdx === 0 && itemIdx < 4
                  const meetsLevel = level >= item.level_required
                  const isPending = shelfBlockedItemIds.has(item.id)
                  /**
                   * 카드 흐림(비활성) 원인 분리:
                   * - 기존: 잔액 부족/레벨 미달 모두 흐림
                   * - 변경: 레벨 미달만 흐림 (잔액 부족은 구매 버튼에서만 안내)
                   */
                  const isDimmed = !meetsLevel
                  const isBest = item.id === bestItemId

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemClick(item, frameKey)}
                      className={`relative flex w-[4.7rem] shrink-0 snap-start flex-col rounded-xl bg-white/95 p-1 pt-1.5 shadow-md ring-1 ring-black/[0.06] transition-transform active:scale-[0.98] ${
                        isDimmed ? 'grayscale brightness-[0.72]' : ''
                      }`}
                    >
                      {isBest && !isDimmed && (
                        <span className="absolute right-0.5 top-0.5 z-10 rounded-full bg-green-500 px-1 py-px text-[7px] font-black leading-none text-white">
                          BEST
                        </span>
                      )}
                      {isPending && (
                        <span className="absolute left-0.5 top-0.5 z-10 text-[10px]" aria-hidden>
                          ⏳
                        </span>
                      )}

                      <div className="relative flex w-full items-end justify-center overflow-visible" style={{ height: SHELF_IMG_AREA_PX }}>
                        <div className="flex max-h-full max-w-full items-end justify-center">
                          <StoreItemThumbnail
                            imageUrl={item.image_url}
                            frame={frameKey}
                            height={SHELF_SPRITE_H}
                            width={SHELF_IMG_AREA_PX}
                            className="max-h-full max-w-full object-contain object-bottom"
                            style={{ maxHeight: SHELF_SPRITE_H }}
                            priority={thumbPriority}
                            loading="lazy"
                            sizes={`${SHELF_IMG_AREA_PX}px`}
                          />
                        </div>
                      </div>

                      <div className="mt-0.5 flex flex-col items-center gap-0.5">
                        <div
                          className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-gray-100 bg-white px-1 py-px shadow-sm"
                          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
                        >
                          <SpriteImage sheet={ICONS} frame="credit" width={11} clipRotated={false} />
                          <span className="truncate text-[8px] font-black tabular-nums text-brand-blue sm:text-[9px]">
                            {formatMarketCreditLabel(item.credit_price)}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/*
        하단 크레딧 바(마켓 전용):
        마켓에서 쓸 수 있는 돈은 지갑(마켓) 잔액뿐이라, 저금통 등을 합친 '전체'는 보여주지 않습니다.
      */}
      <div
        className={`flex shrink-0 flex-col gap-1 border-t border-amber-900/10 bg-[#F3EBE2]/95 px-3 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur-[6px] sm:px-4 sm:py-2.5 ${
          myRequests.length > 0 || wishlistItemIds.length > 0 ? 'pr-[4.5rem]' : ''
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="flex shrink-0 items-center" aria-hidden>
            <Image
              src={walletImageSrcByStage(animatedWalletIdx)}
              alt=""
              width={40}
              height={40}
              className="h-auto w-10 select-none object-contain"
              draggable={false}
            />
          </span>
          <div className="flex min-w-0 flex-1 items-baseline gap-1.5 text-gray-700">
            {/* 요청사항: '지갑(마켓)' 텍스트 대신 크레딧 아이콘으로 의미를 표시 */}
            <SpriteImage sheet={ICONS} frame="credit" width={16} clipRotated={false} />
            <span className="truncate text-lg font-black tabular-nums text-brand-blue sm:text-xl">
              {currentWallet.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/*
        플로팅 버튼 스택(오른쪽 하단):
        - 장바구니에 담긴 게 있으면 가방 아이콘을 배송(오토바이) 버튼 **위**에 둡니다.
        - 원형 버튼·스프라이트는 작게 두고 `gap-3` 으로 간격을 넓혀, 두 개가 붙어 보이지 않게 합니다.
        - `bottom` 은 독바(60px) + 여유 + safe-area 로 잡아 탭바에 가리지 않게 합니다.
        - 부모는 `pointer-events-none`, 버튼만 `pointer-events-auto` 로 배경 탭이 막히지 않게 합니다.
      */}
      {(wishlistItemIds.length > 0 || myRequests.length > 0) && (
        <div
          className="pointer-events-none fixed right-4 z-[55] flex flex-col gap-3 items-end sm:right-5"
          style={{
            bottom: 'max(1rem, calc(60px + 0.85rem + env(safe-area-inset-bottom, 0px)))',
          }}
        >
          {wishlistItemIds.length > 0 && (
            <button
              type="button"
              onClick={() => setWishlistSheetOpen(true)}
              className="pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-amber-200/90 transition-transform active:scale-95"
              aria-label={`장바구니 열기, ${wishlistTotalCount}개`}
            >
              {/* 요청사항: 플로팅 장바구니 아이콘을 basket_filled.png 로 통일 — 하단 플로팅이라 lazy */}
              <Image
                src={BASKET_FILLED_SRC}
                alt=""
                width={24}
                height={24}
                loading="lazy"
                sizes="24px"
                className="h-6 w-6 object-contain"
                draggable={false}
              />
              <span className="absolute -right-0.5 -top-0.5 flex min-h-[1rem] min-w-[1rem] items-center justify-center rounded-full bg-brand-blue px-0.5 text-[9px] font-black tabular-nums text-white ring-2 ring-white">
                {wishlistTotalCount > 99 ? '99+' : wishlistTotalCount}
              </span>
            </button>
          )}
          {myRequests.length > 0 && (
            <button
              type="button"
              onClick={() => setRequestsSheetOpen(true)}
              className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md ring-2 transition-transform active:scale-95 ${
                hasActiveRequestPipeline ? 'ring-brand-blue/50 animate-market-moto' : 'ring-gray-200 opacity-90'
              }`}
              aria-label="내 요청 현황 열기"
            >
              <SpriteImage sheet={SHOP_ANIMATIONS} frame="delivery" width={34} clipRotated={false} />
            </button>
          )}
        </div>
      )}

      <MarketWishlistBottomSheet
        open={wishlistSheetOpen}
        onClose={() => setWishlistSheetOpen(false)}
        wishlistEntries={wishlistEntriesResolved}
        wishlistCount={wishlistTotalCount}
        wishlistTotalCredits={wishlistTotalCredits}
        currentWallet={currentWallet}
        wishlistShortage={wishlistShortage}
        busyItemId={wishBusy}
        onRemoveItem={removeWishlistItem}
        onChangeQty={updateWishlistQuantity}
      />

      <MarketRequestsBottomSheet
        open={requestsSheetOpen}
        onClose={() => setRequestsSheetOpen(false)}
        requests={myRequests}
        marketItems={marketEligibleItems}
      />

      <MarketPurchaseSuccessOverlay open={purchaseCelebrationOpen} onDismiss={dismissPurchaseCelebration} />

      {/*
        선반 카드 탭 후: 구매(바로 결제 플로우) vs 장바구니 담기/빼기
      */}
      {shelfActionFor && (
        <div
          className="fixed inset-0 z-[88] flex items-center justify-center bg-black/45 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="market-shelf-action-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="닫기"
            onClick={dismissShelfAction}
          />
          {/* 독바에 가리지 않도록 중앙 고정 + 이전보다 작은 크기(절반 수준)로 제한 */}
          <div className="relative z-[1] mx-auto w-full max-w-[18rem] rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/[0.06]">
            <p id="market-shelf-action-title" className="text-center text-base font-black text-brand-text">
              {shelfActionFor.item.name}
            </p>
            {/* 상품 썸네일: 뒤쪽 색·테두리 없이 그림만 보이게(팝업 흰 배경 위에 이미지) */}
            <div className="mt-2.5 flex justify-center" aria-hidden>
              <StoreItemThumbnail
                imageUrl={shelfActionFor.item.image_url}
                frame={shelfActionFor.frame}
                height={60}
                className="max-h-[4.25rem] max-w-[min(100%,5rem)] object-contain"
                priority
                sizes="80px"
              />
            </div>
            {/* 요청사항: 레벨 표시는 제거하고, 크레딧 가독성을 높이기 위해 숫자 크기를 키웁니다. */}
            <div className="mt-2 text-center text-sm font-bold text-gray-500">
              <SpriteImage sheet={ICONS} frame="credit" width={14} className="inline-block align-[-2px]" clipRotated={false} />{' '}
              <span className="tabular-nums text-lg font-black text-brand-blue">
                {formatMarketCreditLabel(shelfActionFor.item.credit_price)}
              </span>
            </div>

            {/* 액션 버튼을 한 줄 2칸으로 배치해 선택지를 직관적으로 비교 */}
            <div className="mt-4 flex flex-col gap-2">
              {shelfActionBuyMeta && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {/*
                      구매 / 장바구니: 그림(아이콘)을 크게, 글자는 작게 두어
                      한눈에 「지갑으로 바로 산다 / 바구니에 담는다」가 구분되게 합니다.
                    */}
                    <button
                      type="button"
                      disabled={!shelfActionBuyMeta.canBuy}
                      onClick={openPurchaseFromShelfAction}
                      className="rounded-2xl bg-sky-100 px-2 py-3 text-sky-950 shadow-md ring-1 ring-sky-200/90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:ring-0 active:scale-[0.99] disabled:active:scale-100"
                    >
                      {/* 연한 파란 배경 + 진한 글자로 「구매」가 부드럽게 보이게 */}
                      <span className="inline-flex flex-col items-center justify-center gap-1.5 leading-none">
                        {/* 미션·마켓 하단과 같은 9단계 지갑 PNG(스프라이트 지갑 대신 최신 일러스트) */}
                        <Image
                          src={walletImageSrcByStage(animatedWalletIdx)}
                          alt=""
                          width={36}
                          height={36}
                          className="h-9 w-9 shrink-0 select-none object-contain drop-shadow-sm"
                          draggable={false}
                        />
                        <span className="text-[10px] font-black tracking-tight text-sky-950">구매하기</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={wishBusy === shelfActionBuyMeta.it.id}
                      onClick={() => void cartFromShelfAction()}
                      className="rounded-2xl bg-amber-100 px-2 py-3 text-amber-950 shadow-md ring-1 ring-amber-200/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
                    >
                      {/* 구매하기와 같은 블록 스타일(ring·그림자·패딩)·색만 노란 계열 */}
                      <span className="inline-flex flex-col items-center justify-center gap-1.5 leading-none">
                        <Image
                          src={BASKET_FILLED_SRC}
                          alt=""
                          width={36}
                          height={36}
                          loading="lazy"
                          sizes="36px"
                          className="h-9 w-9 shrink-0 object-contain drop-shadow-sm"
                          draggable={false}
                        />
                        <span className="text-[10px] font-black tracking-tight text-amber-950">장바구니</span>
                      </span>
                    </button>
                  </div>
                  {!shelfActionBuyMeta.canBuy && (
                    <p className="text-center text-[10px] font-bold text-orange-700/90">
                      {!shelfActionBuyMeta.levelOk
                        ? `레벨 ${shelfActionBuyMeta.it.level_required} 이상일 때 살 수 있어요`
                        : !shelfActionBuyMeta.affordOk
                          ? '지갑 크레딧이 부족해요'
                          : null}
                    </p>
                  )}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={dismissShelfAction}
              className="mt-2.5 w-full py-2 text-sm font-bold text-gray-500"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {wishlistAddedNoticeOpen && (
        <div
          className="fixed inset-0 z-[91] flex items-center justify-center bg-black/45 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="market-wishlist-added-title"
        >
          {/* 바깥 탭: 팝업만 닫고 장바구니 시트는 열지 않음 */}
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="닫기"
            onClick={() => setWishlistAddedNoticeOpen(false)}
          />
          <div className="relative z-[1] mx-auto w-full max-w-[18rem] rounded-3xl bg-white p-5 text-center shadow-2xl ring-1 ring-black/[0.06]">
            {/* 마켓 전역과 동일한 장바구니 일러스트 — 담긴 것을 직관적으로 보여 줌 */}
            <div className="mx-auto flex justify-center">
              <Image
                src={BASKET_FILLED_SRC}
                alt=""
                width={64}
                height={64}
                loading="lazy"
                sizes="64px"
                className="h-16 w-16 object-contain drop-shadow-sm"
                draggable={false}
              />
            </div>
            <p id="market-wishlist-added-title" className="mt-3 text-base font-black text-brand-text">
              장바구니에 담았어요!
            </p>
            <p className="mt-1 text-xs font-bold text-gray-500">담긴 물건을 확인해 볼까요?</p>
            <button
              type="button"
              onClick={() => {
                setWishlistAddedNoticeOpen(false)
                setWishlistSheetOpen(true)
              }}
              className="mt-5 w-full rounded-2xl bg-amber-100 py-3.5 text-sm font-black text-amber-950 shadow-md ring-1 ring-amber-200/90 active:scale-[0.99]"
            >
              장바구니 보러가기
            </button>
            <button
              type="button"
              onClick={() => setWishlistAddedNoticeOpen(false)}
              className="mt-2 w-full py-2 text-sm font-bold text-gray-500"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {parentShopNoticeOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="parent-shop-notice-title"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white px-6 py-7 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex justify-center drop-shadow-md">
              <SpriteImage sheet={SHOP_ANIMATIONS} frame="delivery" width={100} clipRotated={false} />
            </div>
            <p id="parent-shop-notice-title" className="text-lg font-black leading-snug text-brand-text">
              제품이 오고있어요!
              <br />
              조금만 기다려주세요.
            </p>
            <button
              type="button"
              onClick={() => {
                setParentShopNoticeOpen(false)
                setRequestsSheetOpen(true)
              }}
              className="mt-6 w-full rounded-2xl bg-brand-blue py-3.5 text-sm font-black text-white shadow-md active:scale-[0.98]"
            >
              내 요청 현황 보기
            </button>
            <button
              type="button"
              onClick={() => setParentShopNoticeOpen(false)}
              className="mt-2 w-full py-2.5 text-sm font-bold text-gray-500"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {selected && (
        <MarketPurchaseConfirmDialog
          selected={selected}
          balanceBefore={currentWallet}
          onClose={dismissPurchaseDialog}
          onSubmit={submitPurchaseRequest}
          onSuccessDismiss={onPurchaseDialogSuccessDismiss}
        />
      )}

      {/* 배달 연출: 승인 직후 — 체크(allow)·선물(reward) + 오토바이(delivery) 플로팅 */}
      {MARKET_DELIVERY_OVERLAY_ENABLED && delivery && delivery.phase === 'shipping' && (
        <div className="fixed inset-0 z-[45] flex flex-col items-center justify-center bg-black/45 px-5">
          <p className="mb-4 text-center text-lg font-black leading-snug text-white drop-shadow-md">
            구매가 승인되어
            <br />
            배달이 시작되었어요!
          </p>
          <div className="flex items-end justify-center gap-2">
            <SpriteImage sheet={SHOP_ANIMATIONS} frame="allow" width={100} clipRotated={false} />
            <SpriteImage sheet={SHOP_ANIMATIONS} frame="reward" width={88} clipRotated={false} />
          </div>
          <p className="mt-3 text-center text-sm font-bold text-white/90">곧 도착해요</p>

          <div
            className="pointer-events-none fixed bottom-28 left-5 z-[46] animate-market-moto drop-shadow-xl"
            aria-hidden
          >
            <SpriteImage sheet={SHOP_ANIMATIONS} frame="delivery" width={72} clipRotated={false} />
          </div>
        </div>
      )}

      {MARKET_DELIVERY_OVERLAY_ENABLED && delivery && delivery.phase === 'parachute' && (
        <div className="fixed inset-0 z-[45] flex flex-col items-center justify-center bg-gradient-to-b from-sky-300/90 to-amber-50/95 px-5">
          <p className="mb-6 text-center text-lg font-black text-brand-text">상품이 도착했어요!</p>

          <div
            className="pointer-events-none fixed bottom-28 left-5 z-[46] animate-market-moto drop-shadow-xl"
            aria-hidden
          >
            <SpriteImage sheet={SHOP_ANIMATIONS} frame="delivery" width={64} clipRotated={false} />
          </div>

          <div className="animate-market-parachute flex flex-col items-center">
            <span className="text-4xl" aria-hidden>
              🪂
            </span>
            <div className="-mt-1 flex items-end justify-center" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}>
              <StoreItemThumbnail
                imageUrl={delivery.itemImageUrl}
                frame={delivery.frame}
                height={96}
                className="max-h-[96px] max-w-[min(100vw-2rem,200px)] object-contain object-bottom"
                loading="lazy"
                sizes="(max-width: 480px) 40vw, 200px"
              />
            </div>
            <p className="mt-2 text-center text-sm font-bold text-gray-600">{delivery.request.item_name}</p>
          </div>

          {showReceiveBtn && (
            <button
              type="button"
              disabled={loading === 'delivery'}
              onClick={() => void completeDeliveryFlow()}
              className="mt-10 rounded-2xl bg-brand-blue px-8 py-3.5 text-sm font-black text-white shadow-lg disabled:opacity-50"
            >
              {loading === 'delivery' ? '처리 중...' : '받았어요!'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
