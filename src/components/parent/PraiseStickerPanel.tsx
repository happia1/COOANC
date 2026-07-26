'use client'

import { useCallback, useRef, useState } from 'react'
import {
  PRAISE_ASSET_STICKER_PANEL_BODY_ROWS,
  praiseAssetStickerTitle,
  praiseAssetStickerUrl,
} from '@/lib/praiseAssetStickers'
import { PARENT_POPUP_BTN } from '@/lib/parentPopupCardStyles'
import ParentChevron from '@/components/parent/ParentChevron'

/** 하트 5종 + 별 5종을 한 줄로 이어 붙인 목록 */
const STICKER_KEYS = PRAISE_ASSET_STICKER_PANEL_BODY_ROWS.flat()

type Props = {
  childId: string | null
  childName: string
}

/**
 * 승인 탭 — 스티커를 누르면 확인 후 자녀에게 칭찬 스티커를 보냅니다.
 *
 * 비개발자 설명:
 * - 스티커를 두 줄 격자로 펼쳐 두어 자리를 많이 차지했습니다.
 *   이제 **한 줄**로 두고 좌우로 밀어서 고릅니다(양옆 화살표 또는 손가락 스와이프).
 * - 접기·펼치기는 없앴습니다. 한 줄이라 접을 만큼 크지 않습니다.
 * (스티커판 비우기·보낸 기록 일괄 삭제는 이 패널에서 제공하지 않습니다.)
 */
export default function PraiseStickerPanel({ childId }: Props) {
  /** 어떤 스티커를 보낼지 고른 뒤 확인 모달을 띄울 때 사용하는 키 */
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  /** 스티커 전송 중이면 버튼을 비활성화합니다 */
  const [loading, setLoading] = useState(false)
  /** 전송 실패 시에만 아래 한 줄로 오류를 보여 줍니다(성공 메시지는 표시하지 않음). */
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null)
  /** 가로 스크롤 줄 — 좌우 화살표로 한 번에 몇 칸씩 밀어 줍니다 */
  const railRef = useRef<HTMLDivElement>(null)

  const slide = useCallback((dir: -1 | 1) => {
    const el = railRef.current
    if (!el) return
    // 보이는 폭의 80%씩 — 끝에 걸쳐 잘린 스티커가 다음 화면 첫 칸으로 오도록
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }, [])

  const send = useCallback(
    async (spriteKey: string) => {
      if (!childId) return
      setLoading(true)
      setToast(null)
      try {
        const res = await fetch('/api/praise-sticker/grant', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, spriteKey }),
        })
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          setToast({ text: json.error ?? '전송에 실패했어요', ok: false })
          return
        }
        setToast(null)
        setConfirmKey(null)
      } catch {
        setToast({ text: '네트워크 오류가 났어요', ok: false })
      } finally {
        setLoading(false)
      }
    },
    [childId],
  )

  if (!childId) {
    return null
  }

  return (
    <section className="w-full rounded-2xl border border-brand-blue/20 bg-sky-50/80 p-4 shadow-sm">
      <div className="mb-2">
        <h2 className="text-sm font-bold text-brand-text">칭찬 스티커 보상</h2>
        <p className="mt-1 text-[11px] leading-snug text-gray-600">
          스티커를 클릭하면 선물할 수 있어요!
        </p>
      </div>

      {/**
       * 한 줄 가로 슬라이드 — 하트 5종 + 별 5종을 순서대로 이어 붙입니다.
       * 양옆 화살표로 밀거나, 손가락으로 그대로 스와이프해도 됩니다.
       */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => slide(-1)}
          aria-label="이전 스티커 보기"
          className="flex h-9 w-6 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/70 hover:text-gray-600 active:opacity-70"
        >
          <ParentChevron direction="left" size="lg" />
        </button>

        <div
          ref={railRef}
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: 'x proximity' }}
        >
          {STICKER_KEYS.map((spriteKey) => {
            const src = praiseAssetStickerUrl(spriteKey)
            const title = praiseAssetStickerTitle(spriteKey)
            return (
              <button
                key={spriteKey}
                type="button"
                disabled={loading || !src}
                onClick={() => setConfirmKey(spriteKey)}
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-white/90 bg-white p-0.5 shadow-sm transition active:scale-95 disabled:opacity-50"
                style={{ scrollSnapAlign: 'start' }}
                title={title}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- public 정적 PNG, next/image보다 단순
                  <img src={src} alt="" className="h-8 w-8 object-contain" width={32} height={32} />
                ) : null}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => slide(1)}
          aria-label="다음 스티커 보기"
          className="flex h-9 w-6 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/70 hover:text-gray-600 active:opacity-70"
        >
          <ParentChevron direction="right" size="lg" />
        </button>
      </div>

      {toast && (
        <p className={`mt-3 text-center text-xs font-bold ${toast.ok ? 'text-brand-blue' : 'text-red-500'}`}>
          {toast.text}
        </p>
      )}

      {confirmKey && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-6">
          {/* 내용 높이에 맞춘 컴팩트 카드 — 공통 고정 높이(min-h-[22rem])를 쓰지 않아 불필요한 여백을 없앱니다 */}
          <div className="relative z-10 flex w-full max-w-xs flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-center text-base font-black text-brand-text">스티커를 선물하시겠어요?</p>
            {/* 선택한 스티커 미리보기 — confirmKey 로 같은 PNG URL 을 그려 부모가 무엇을 보내는지 확인합니다 */}
            {praiseAssetStickerUrl(confirmKey) ? (
              <div className="mt-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- public 정적 PNG, next/image보다 단순 */}
                <img
                  src={praiseAssetStickerUrl(confirmKey)!}
                  alt={praiseAssetStickerTitle(confirmKey)}
                  width={72}
                  height={72}
                  className="object-contain"
                  style={{ width: 72, height: 72 }}
                />
              </div>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setConfirmKey(null)}
                className={`${PARENT_POPUP_BTN} border border-gray-200 bg-white text-gray-500`}
              >
                아니오
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void send(confirmKey)}
                className={`${PARENT_POPUP_BTN} bg-brand-blue text-white shadow-md disabled:opacity-50`}
              >
                {loading ? '보내는 중...' : '예'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
