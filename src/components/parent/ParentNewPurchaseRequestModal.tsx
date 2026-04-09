'use client'

/**
 * 부모 앱 전역: 자녀가 마켓에서 구매 요청을 넣으면(Realtime INSERT) 알림 팝업을 띄우고
 * 「구매 요청 확인하기」로 승인 탭의 구매 요청 구역으로 이동합니다.
 *
 * 팝업 중앙에는 요청한 상품 사진(또는 기본 일러스트)을 보여 줘서, 글만 봐도 헷갈리지 않게 합니다.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MarketItemImage from '@/components/common/MarketItemImage'
import { marketFrameKeyForItemId } from '@/lib/marketItemFrame'
import { useParentStore } from '@/store/parentStore'

/** 모달이 닫혀 있을 때 / 열려 있을 때(자녀·상품 정보) */
type ModalState =
  | { open: false }
  | { open: true; childId: string; itemId: string | null; itemName: string | null }

export default function ParentNewPurchaseRequestModal() {
  const router = useRouter()
  const setSelectedChildId = useParentStore((s) => s.setSelectedChildId)
  const [modal, setModal] = useState<ModalState>({ open: false })
  /** DB `store_items.image_url` — 있으면 실제 상품 사진을 팝업에 씁니다 */
  const [itemImageUrl, setItemImageUrl] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role !== 'parent' || cancelled) return

      const { data: links } = await supabase.from('family_links').select('child_id').eq('parent_id', user.id)
      const childIds = new Set((links ?? []).map((r: { child_id: string }) => r.child_id))
      if (childIds.size === 0 || cancelled) return

      const channel = supabase
        .channel(`parent_new_purchase:${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'purchase_requests' },
          (payload) => {
            // Realtime 이 넘기는 새 행: 상품 id·이름이 있으면 이미지 조회에 씁니다
            const row = payload.new as {
              child_id?: string
              status?: string
              item_id?: string | null
              item_name?: string | null
            }
            if (!row.child_id || !childIds.has(row.child_id)) return
            if (row.status !== 'pending') return
            setModal({
              open: true,
              childId: row.child_id,
              itemId: row.item_id ?? null,
              itemName: row.item_name ?? null,
            })
          },
        )
        .subscribe()

      channelRef.current = channel
    })()

    return () => {
      cancelled = true
      const ch = channelRef.current
      channelRef.current = null
      if (ch) void supabase.removeChannel(ch)
    }
  }, [])

  // 모달이 뜬 뒤 상품 id 로 마켓 테이블에서 사진 URL 만 가져옵니다(없으면 아래에서 기본 그림 사용)
  useEffect(() => {
    if (!modal.open || !modal.itemId) {
      setItemImageUrl(null)
      return
    }
    let cancelled = false
    const supabase = createClient()
    void (async () => {
      const { data } = await supabase.from('store_items').select('image_url').eq('id', modal.itemId).maybeSingle()
      if (!cancelled) {
        const url = data?.image_url
        setItemImageUrl(typeof url === 'string' && url.trim() !== '' ? url.trim() : null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [modal])

  /** 승인 탭의 구매 요청 블록으로 스크롤(탭 전환·새로고침 직후 DOM 타이밍을 두 번 잡습니다) */
  function scrollToPurchaseSection() {
    document.getElementById('parent-purchase-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleGoToApproval() {
    if (!modal.open) return
    setSelectedChildId(modal.childId)
    setModal({ open: false })

    const onApproval =
      typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/parent/approval'

    if (onApproval) {
      window.location.hash = 'parent-purchase-requests'
      router.refresh()
      requestAnimationFrame(() => {
        scrollToPurchaseSection()
        window.setTimeout(scrollToPurchaseSection, 280)
      })
      return
    }

    router.push('/parent/approval#parent-purchase-requests')
    router.refresh()
    window.setTimeout(scrollToPurchaseSection, 200)
    window.setTimeout(scrollToPurchaseSection, 550)
  }

  if (!modal.open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-new-purchase-title"
      onClick={() => setModal({ open: false })}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white px-6 py-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="parent-new-purchase-title" className="text-center text-lg font-black leading-snug text-brand-text">
          자녀가 구매를 요청했어요!
        </p>
        {/* 어떤 상품인지 한눈에 — 사진이 있으면 URL, 없으면 다른 화면과 같은 규칙의 기본 일러스트 */}
        <div
          className="mx-auto mt-3 flex h-[120px] w-[120px] items-end justify-center overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-100"
          aria-hidden
        >
          {itemImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase 등 외부 저장소 URL
            <img
              src={itemImageUrl}
              alt=""
              className="max-h-full max-w-full object-contain object-bottom"
              draggable={false}
            />
          ) : (
            <MarketItemImage
              frame={marketFrameKeyForItemId(modal.itemId, modal.itemName ?? '')}
              height={100}
              className="pb-1"
            />
          )}
        </div>
        {modal.itemName && (
          <p className="mt-2 text-center text-sm font-bold text-gray-600">&ldquo;{modal.itemName}&rdquo;</p>
        )}
        <p className="mt-2 text-center text-xs leading-relaxed text-gray-500">
          승인 탭에서 요청을 확인할 수 있어요.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleGoToApproval}
            className="w-full rounded-2xl bg-brand-blue py-3.5 text-sm font-black text-white shadow-md active:scale-[0.98]"
          >
            구매 요청 확인하기
          </button>
          <button
            type="button"
            onClick={() => setModal({ open: false })}
            className="w-full rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  )
}
