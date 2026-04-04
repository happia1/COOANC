'use client'

import { useState } from 'react'
import type { PurchaseRequest } from '@/types/database'

const REJECT_PRESETS = [
  '아직은 너무 일러요',
  '다음 기회에 사자',
  '다른 걸 먼저 모아봐',
  '엄마·아빠랑 같이 가서 고르자',
]

type MissionLog = {
  id: string
  child_id: string
  assigned_date: string
  completed_at: string | null
  credit_earned: number
  heart_earned: number
  exp_earned: number
  missions: { title: string; icon_emoji: string } | null
}

type Props = {
  pendingRequests: PurchaseRequest[]
  recentLogs: MissionLog[]
  childNameMap: Record<string, string>
}

export default function ApprovalTab({ pendingRequests, recentLogs, childNameMap }: Props) {
  const [requests, setRequests] = useState<PurchaseRequest[]>(pendingRequests)
  const [logs, setLogs] = useState<MissionLog[]>(recentLogs)

  // 반려 모달 상태
  const [rejectModal, setRejectModal] = useState<{ requestId: string; itemName: string } | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  // 롤백 확인 모달
  const [rollbackModal, setRollbackModal] = useState<{ logId: string; title: string } | null>(null)

  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  // ── 승인
  async function handleApprove(requestId: string) {
    setLoading(requestId)
    try {
      const res = await fetch('/api/market/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'approve' }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) { showToast(json.error ?? '오류가 발생했어요', false); return }
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
      showToast('✅ 승인했어요! 자녀에게 전달됩니다.')
    } catch { showToast('네트워크 오류가 발생했어요', false) }
    finally { setLoading(null) }
  }

  // ── 반려
  async function handleReject() {
    if (!rejectModal) return
    setLoading(rejectModal.requestId)
    try {
      const res = await fetch('/api/market/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: rejectModal.requestId, action: 'reject', parentNote: rejectNote || null }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) { showToast(json.error ?? '오류가 발생했어요', false); return }
      setRequests((prev) => prev.filter((r) => r.id !== rejectModal.requestId))
      setRejectModal(null)
      setRejectNote('')
      showToast('반려 처리했어요.')
    } catch { showToast('네트워크 오류가 발생했어요', false) }
    finally { setLoading(null) }
  }

  // ── 미션 롤백
  async function handleRollback() {
    if (!rollbackModal) return
    setLoading(rollbackModal.logId)
    try {
      const res = await fetch('/api/mission/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionLogId: rollbackModal.logId }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) { showToast(json.error ?? '오류가 발생했어요', false); return }
      setLogs((prev) => prev.filter((l) => l.id !== rollbackModal.logId))
      setRollbackModal(null)
      showToast('미션을 미완료 상태로 되돌렸어요.')
    } catch { showToast('네트워크 오류가 발생했어요', false) }
    finally { setLoading(null) }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 font-bold text-sm px-5 py-2.5 rounded-full shadow-lg ${toast.ok ? 'bg-brand-blue text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* 반려 모달 */}
      {rejectModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center">
          <div className="w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl">
            <p className="font-black text-brand-text text-base mb-1">반려 사유 선택</p>
            <p className="text-xs text-gray-400 mb-4">{rejectModal.itemName}</p>

            <div className="flex flex-col gap-2 mb-4">
              {REJECT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setRejectNote(preset)}
                  className={`text-left text-sm px-4 py-2.5 rounded-xl border transition-all ${rejectNote === preset ? 'border-brand-blue bg-brand-blue/10 font-bold text-brand-blue' : 'border-gray-200 text-gray-600'}`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="직접 입력하기"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setRejectModal(null); setRejectNote('') }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={!!loading}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold shadow-md active:scale-95 disabled:opacity-50"
              >
                반려하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 롤백 확인 모달 */}
      {rollbackModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-center">
            <p className="text-3xl mb-3">↩️</p>
            <p className="font-black text-brand-text text-base mb-2">미션을 미완료로 되돌릴까요?</p>
            <p className="text-sm text-gray-400 mb-1">
              <span className="font-bold text-brand-text">{rollbackModal.title}</span>
            </p>
            <p className="text-xs text-gray-400 mb-6">획득한 크레딧·하트·EXP가 회수됩니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setRollbackModal(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                onClick={handleRollback}
                disabled={!!loading}
                className="flex-1 py-3 rounded-2xl bg-orange-500 text-white text-sm font-bold shadow-md active:scale-95 disabled:opacity-50"
              >
                롤백하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div>
        <p className="font-black text-brand-text text-xl">✅ 승인 & 롤백</p>
        <p className="text-xs text-gray-400 mt-0.5">구매 요청을 확인하고 미션을 관리해요</p>
      </div>

      {/* 구매 요청 */}
      <section>
        <h2 className="text-sm font-bold text-brand-text mb-2">🛒 구매 요청</h2>

        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm text-gray-400">대기 중인 구매 요청이 없어요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-amber-400">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-brand-text">{req.item_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {childNameMap[req.child_id] ?? '자녀'} · {req.requested_at.slice(0, 10)}
                    </p>
                    {req.child_message && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1 mt-2 italic">
                        "{req.child_message}"
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-brand-blue text-lg">🪙{req.item_price}</p>
                    <p className="text-[10px] text-gray-400">{req.item_type === 'digital' ? '디지털' : '실물'}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setRejectModal({ requestId: req.id, itemName: req.item_name })}
                    disabled={loading === req.id}
                    className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                  >
                    반려
                  </button>
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={loading === req.id}
                    className="flex-1 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading === req.id ? '처리 중...' : '승인 ✓'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 미션 롤백 */}
      <section>
        <h2 className="text-sm font-bold text-brand-text mb-2">↩️ 미션 롤백</h2>
        <p className="text-xs text-gray-400 mb-2">완료된 미션이 실제로 수행되지 않았다면 되돌릴 수 있어요</p>

        {logs.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <p className="text-sm text-gray-400">최근 완료 미션이 없어요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map((log) => (
              <div key={log.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                <span className="text-xl flex-shrink-0">{log.missions?.icon_emoji ?? '⭐'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-brand-text truncate">
                    {log.missions?.title ?? '미션'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {childNameMap[log.child_id] ?? '자녀'} · {log.completed_at?.slice(0, 10)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-brand-blue">+{log.credit_earned}🪙</p>
                  <button
                    onClick={() => setRollbackModal({ logId: log.id, title: log.missions?.title ?? '미션' })}
                    disabled={loading === log.id}
                    className="text-[10px] text-orange-500 font-bold mt-0.5 hover:underline disabled:opacity-50"
                  >
                    롤백
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
