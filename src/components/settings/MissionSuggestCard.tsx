'use client'

/**
 * 부모 루틴 탭 — 새 미션 키워드를 직접 넣지 않고, 운영에 「추가 제안」만 보냅니다.
 */

import { useState } from 'react'

export default function MissionSuggestCard() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit() {
    setMsg(null)
    if (text.trim().length < 2) {
      setMsg('내용을 조금 더 적어 주세요.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/feedback/mission-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(typeof j.error === 'string' ? j.error : '전송에 실패했어요.')
        return
      }
      setText('')
      setOpen(false)
      setMsg('제안을 보냈어요. 검토 후 반영될 수 있어요.')
    } catch {
      setMsg('네트워크 오류가 났어요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">미션·루틴</p>
      <p className="mt-1 text-[11px] leading-snug text-gray-500">
        앱에 없는 루틴을 쓰고 싶다면 여기서 제안해 주세요. 직접 입력으로 만든 미션은 아이콘 매칭이 어긋날 수 있어요.
      </p>
      {msg && !open && (
        <p className="mt-2 text-xs font-bold text-[#4A90E2]">{msg}</p>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            setMsg(null)
          }}
          className="mt-3 w-full rounded-xl border-2 border-dashed border-[#4A90E2]/40 py-3 text-sm font-bold text-[#4A90E2] transition-colors hover:bg-[#4A90E2]/5"
        >
          미션 추가 제안하기
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="예: 피아노 연습, 반려견 산책, 식물 물주기…"
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
          />
          {msg && <p className="text-xs text-red-500">{msg}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setOpen(false)
                setMsg(null)
              }}
              className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-600"
            >
              취소
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={submit}
              className="flex-1 rounded-xl bg-[#4A90E2] py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {loading ? '보내는 중…' : '보내기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
