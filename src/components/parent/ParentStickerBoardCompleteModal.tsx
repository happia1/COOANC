'use client'

/**
 * 부모 앱 전역: 자녀가 스티커판 20칸을 모두 채우고 「엄마에게 알려주기」를 누르면
 * Supabase Realtime 브로드캐스트로 이 컴포넌트가 메시지를 받아 팝업을 띄웁니다.
 * (DB 테이블 없이도 같은 가족 부모 화면에 바로 뜨도록 설계했습니다.)
 */

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ModalState = { open: false } | { open: true; childId: string }

export default function ParentStickerBoardCompleteModal() {
  const [modal, setModal] = useState<ModalState>({ open: false })
  /** 구독해 둔 채널들 — 언마운트 때 모두 끊어 메모리 누수를 막습니다 */
  const channelsRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']>[]>([])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    channelsRef.current = []

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role !== 'parent' || cancelled) return

      const { data: links } = await supabase.from('family_links').select('child_id').eq('parent_id', user.id)
      const childIds = (links ?? []).map((r: { child_id: string }) => r.child_id)
      if (childIds.length === 0 || cancelled) return

      const subscribed: ReturnType<typeof supabase.channel>[] = []

      for (const childId of childIds) {
        const ch = supabase
          .channel(`parent_sticker_board:${childId}`, { config: { broadcast: { ack: false } } })
          .on('broadcast', { event: 'sticker_board_filled' }, () => {
            if (cancelled) return
            setModal({ open: true, childId })
          })
          .subscribe()
        subscribed.push(ch)
      }

      if (cancelled) {
        for (const ch of subscribed) void supabase.removeChannel(ch)
        return
      }
      channelsRef.current = subscribed
    })()

    return () => {
      cancelled = true
      for (const ch of channelsRef.current) void supabase.removeChannel(ch)
      channelsRef.current = []
    }
  }, [])

  if (!modal.open) return null

  return (
    <div
      key={modal.childId}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-sticker-board-complete-title"
      onClick={() => setModal({ open: false })}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white px-6 py-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="parent-sticker-board-complete-title"
          className="text-center text-sm font-normal leading-relaxed text-gray-500"
        >
          자녀가 스티커를 모두 채웠어요!
        </p>
        <p className="mt-1.5 text-center text-xs font-normal leading-relaxed text-gray-500">
          마음을 담은 선물을 기다리고 있어요
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setModal({ open: false })}
            className="w-full rounded-2xl bg-brand-blue py-3.5 text-sm font-black text-white shadow-md active:scale-[0.98]"
          >
            확인
          </button>
          {/**
           * 선물구매: 추후 외부 상품 페이지 링크로 연결할 예정입니다.
           * 지금은 눌러도 팝업만 닫아 동작을 맞춰 둡니다.
           */}
          <button
            type="button"
            onClick={() => setModal({ open: false })}
            className="w-full rounded-2xl border-2 border-brand-blue bg-white py-3.5 text-sm font-black text-brand-blue shadow-sm active:scale-[0.98]"
          >
            선물구매
          </button>
        </div>
      </div>
    </div>
  )
}
