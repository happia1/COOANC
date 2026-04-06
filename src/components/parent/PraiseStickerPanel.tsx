'use client'

import { useCallback, useState } from 'react'
import PraiseUiIcon from '@/components/common/PraiseUiIcon'
import type { PraiseUiKind } from '@/lib/praiseStickerUi'

/** 화면에 보이는 순서: 하트얼굴 → 하트 → 날개별 → 별 */
const STICKER_OPTIONS: { kind: PraiseUiKind; spriteKey: string; title: string }[] = [
  { kind: 'heart_face', spriteKey: 'ui:heart_face', title: '하트 얼굴' },
  { kind: 'heart', spriteKey: 'ui:heart', title: '하트' },
  { kind: 'winged_star', spriteKey: 'ui:winged_star', title: '날개 별' },
  { kind: 'star', spriteKey: 'ui:star', title: '별 스티커' },
]

type Props = {
  childId: string | null
  childName: string
}

/**
 * 승인 탭 — 아이콘을 누르면 확인 후 자녀에게 칭찬 스티커를 보냅니다.
 */
export default function PraiseStickerPanel({ childId, childName }: Props) {
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null)

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
        setToast({ text: `${childName}에게 선물했어요!`, ok: true })
        setConfirmKey(null)
      } catch {
        setToast({ text: '네트워크 오류가 났어요', ok: false })
      } finally {
        setLoading(false)
      }
    },
    [childId, childName],
  )

  if (!childId) {
    return null
  }

  return (
    <section className="rounded-2xl border border-brand-blue/20 bg-sky-50/80 p-4 shadow-sm">
      <h2 className="text-sm font-bold text-brand-text">칭찬 스티커 보상</h2>
      <p className="mb-3 mt-1 text-[11px] leading-snug text-gray-600">
        스티커를 클릭하면 자녀에게 스티커를 선물 할 수 있어요!
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {STICKER_OPTIONS.map(({ kind, spriteKey, title }) => (
          <button
            key={spriteKey}
            type="button"
            disabled={loading}
            onClick={() => setConfirmKey(spriteKey)}
            className="flex flex-col items-center gap-1 rounded-2xl border-2 border-white/80 bg-white p-2 shadow-md transition active:scale-95 disabled:opacity-50"
            title={title}
          >
            <PraiseUiIcon kind={kind} size={52} label={title} />
          </button>
        ))}
      </div>

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
