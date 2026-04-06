'use client'

/**
 * 부모 계정 영구 탈퇴 (설정 탭 맨 아래)
 * - 화면에는 작은 회색 「계정 탈퇴」만 보입니다.
 * - 탭하면 안내 팝업 → 「다음」 시 「탈퇴」 입력으로 최종 확인 후 API 호출합니다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/** 최종 단계에서 입력해야 하는 고정 문구(실수 방지) */
const CONFIRM_PHRASE = '탈퇴'

/** 1단계 팝업에 표시하는 안내 문구 — 계정 삭제 전에 꼭 읽을 내용 */
const WITHDRAW_INFO =
  '계정을 삭제하면 부모 로그인 정보와 가족 연결 정보가 영구적으로 사라지며, 되돌릴 수 없습니다. 연결되어 있던 자녀 계정·미션·크레딧 데이터는 그대로 남아 자녀 앱에서 계속 이용할 수 있어요. 자녀 데이터까지 모두 없애려면, 삭제하기 전에 설정의 자녀 프로필에서 휴지통 아이콘으로 각 자녀를 먼저 삭제해 주세요.'

type ModalStep = 'closed' | 'intro' | 'confirm'

export default function DeleteParentAccountSection() {
  const router = useRouter()
  const [step, setStep] = useState<ModalStep>('closed')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = confirmText.trim() === CONFIRM_PHRASE && !loading

  /** 팝업 닫을 때 입력·에러 초기화 */
  function closeModal() {
    setStep('closed')
    setConfirmText('')
    setError(null)
  }

  async function handleWithdraw() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/parent/delete', { method: 'POST' })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : '탈퇴에 실패했어요.')
        return
      }
      const supabase = createClient()
      await supabase.auth.signOut()
      router.replace('/login')
    } catch {
      setError('네트워크 오류가 발생했어요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex justify-center pt-1 pb-2">
        <button
          type="button"
          onClick={() => {
            setStep('intro')
            setConfirmText('')
            setError(null)
          }}
          className="text-[11px] font-medium text-gray-400 underline-offset-2 hover:text-gray-500 hover:underline active:opacity-70"
        >
          계정삭제
        </button>
      </div>

      {step === 'intro' && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-intro-title"
        >
          <button type="button" aria-label="닫기" className="absolute inset-0 cursor-default" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 id="withdraw-intro-title" className="text-center text-sm font-black text-gray-800">
              계정 삭제
            </h3>
            <p className="mt-3 text-left text-xs leading-relaxed text-gray-600">{WITHDRAW_INFO}</p>
            <p className="mt-4 text-center text-xs font-bold text-gray-700">정말 탈퇴하시겠어요?</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('confirm')
                  setError(null)
                }}
                className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-bold text-white shadow-md active:scale-95"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-confirm-title"
        >
          <button type="button" aria-label="닫기" className="absolute inset-0 cursor-default" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 id="withdraw-confirm-title" className="text-center text-sm font-black text-gray-800">
              최종 확인
            </h3>
            <p className="mt-2 text-center text-xs text-gray-500">
              계속하려면 아래에 「{CONFIRM_PHRASE}」라고 입력하세요.
            </p>
            <label className="mt-4 block text-[11px] font-bold text-gray-700">
              확인 입력
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-red-200"
              />
            </label>
            {error && <p className="mt-2 text-center text-[11px] font-bold text-red-600">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setStep('intro')
                  setConfirmText('')
                  setError(null)
                }}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500 disabled:opacity-50"
              >
                이전
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleWithdraw}
                className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-bold text-white shadow-md active:scale-95 disabled:opacity-40"
              >
                {loading ? '처리 중…' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
