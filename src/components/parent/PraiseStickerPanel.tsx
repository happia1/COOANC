'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  PRAISE_ASSET_STICKER_PANEL_BODY_ROWS,
  praiseAssetStickerTitle,
  praiseAssetStickerUrl,
} from '@/lib/praiseAssetStickers'

type Props = {
  childId: string | null
  childName: string
}

/**
 * 승인 탭 — 아이콘을 누르면 확인 후 자녀에게 칭찬 스티커를 보냅니다.
 * (스티커판 비우기·보낸 기록 일괄 삭제는 이 패널에서 제공하지 않습니다.)
 */
export default function PraiseStickerPanel({ childId, childName }: Props) {
  /** 어떤 스티커를 보낼지 고른 뒤 확인 모달을 띄울 때 사용하는 키 */
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  /** 스티커 전송 중이면 버튼을 비활성화합니다 */
  const [loading, setLoading] = useState(false)
  /** 전송 실패 시에만 아래 한 줄로 오류를 보여 줍니다(성공 메시지는 표시하지 않음). */
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null)
  /** 스티커 그리드는 기본 접힘 — 「펼치기」로 15종 전체를 봅니다. */
  const [stickersOpen, setStickersOpen] = useState(false)

  /** 다른 자녀를 고르면 다시 접어 두어 첫 화면을 맞춥니다. */
  useEffect(() => {
    setStickersOpen(false)
  }, [childId])

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
    <section className="rounded-2xl border border-brand-blue/20 bg-sky-50/80 p-4 shadow-sm">
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-brand-text">칭찬 스티커 보상</h2>
          <p className="mt-1 text-[11px] leading-snug text-gray-600">
            스티커를 클릭하면 자녀에게 선물 할 수 있어요!
          </p>
        </div>
        <button
          type="button"
          aria-expanded={stickersOpen}
          onClick={() => setStickersOpen((v) => !v)}
          className="shrink-0 text-[10px] font-medium text-gray-500 underline-offset-2 transition-colors hover:text-gray-700 hover:underline active:opacity-80"
        >
          <span aria-hidden className="mr-0.5 inline-block align-middle text-[9px] leading-none">
            {stickersOpen ? '▲' : '▼'}
          </span>
          {stickersOpen ? '접기' : '펼치기'}
        </button>
      </div>

      {/**
       * 펼침일 때만: 1줄 하트만 · 2줄 별만 · 3줄 기타(라벨 텍스트 없음).
       * 키 묶음은 `PRAISE_ASSET_STICKER_PANEL_BODY_ROWS`.
       */}
      {stickersOpen ? (
        <div className="space-y-2">
          {PRAISE_ASSET_STICKER_PANEL_BODY_ROWS.map((keys, rowIdx) => (
            <div key={`praise-sticker-row-${rowIdx}`} className="grid grid-cols-5 gap-x-1 gap-y-1.5">
              {keys.map((spriteKey) => {
                const src = praiseAssetStickerUrl(spriteKey)
                const title = praiseAssetStickerTitle(spriteKey)
                return (
                  <button
                    key={spriteKey}
                    type="button"
                    disabled={loading || !src}
                    onClick={() => setConfirmKey(spriteKey)}
                    className="flex aspect-square max-h-[52px] items-center justify-center rounded-xl border border-white/90 bg-white p-0.5 shadow-sm transition active:scale-95 disabled:opacity-50"
                    title={title}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- public 정적 PNG, next/image 크기 15종 고정보다 단순
                      <img src={src} alt="" className="h-8 w-8 object-contain" width={32} height={32} />
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      ) : null}

      {toast && (
        <p className={`mt-3 text-center text-xs font-bold ${toast.ok ? 'text-brand-blue' : 'text-red-500'}`}>
          {toast.text}
        </p>
      )}

      {confirmKey && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-center text-base font-black text-brand-text">자녀에게 스티커를 선물하시겠어요?</p>
            <p className="mt-1 text-center text-xs text-gray-500">{childName}에게 전달돼요</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setConfirmKey(null)}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500"
              >
                아니오
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void send(confirmKey)}
                className="flex-1 rounded-2xl bg-brand-blue py-3 text-sm font-bold text-white shadow-md disabled:opacity-50"
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
