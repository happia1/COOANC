'use client'

/**
 * 부모 홈 — 에이전트 A(주간 리포트·코칭) 카드 영역입니다.
 * - `/agent-a/latest` 로 최신 행을 가져와 요약 카드 2개를 그립니다.
 * - 데이터가 없으면(404·빈 텍스트) 파스텔 안내 카드 한 장만 보여 줍니다.
 * - 카드 탭 시 바텀시트로 전체 텍스트·EQ 막대·다음 행동 버튼을 띄웁니다.
 */

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  type AgentEqScores,
  type AgentLatestReportRow,
} from '@/lib/agentApi'
import ParentAgentBottomSheet from '@/components/parent/ParentAgentBottomSheet'

/** 한 줄 미리보기: 공백 제거 후 앞쪽만 잘라 표시합니다(이모지·한글 모두 대략 30자 분량). */
function previewLine(text: string | null | undefined, max = 30): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return '내용이 아직 없어요'
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

/** EQ 막대: 0~100 값을 파스텔 막대로 보여 줍니다(비개발자도 숫자 크기를 직관적으로 볼 수 있음). */
function EqScoreBars({ eq }: { eq: AgentEqScores | null | undefined }) {
  const delay = Math.min(100, Math.max(0, Number(eq?.delay_satisfaction ?? 0)))
  const save = Math.min(100, Math.max(0, Number(eq?.save_ratio ?? 0)))
  const routine = Math.min(100, Math.max(0, Number(eq?.routine_completion ?? 0)))
  const rows = [
    { label: '만족지연(저축 의지)', value: delay, color: 'from-amber-200 to-orange-300' },
    { label: '저축 비율', value: save, color: 'from-lime-200 to-emerald-300' },
    { label: '루틴 완주율', value: routine, color: 'from-sky-200 to-blue-400' },
  ]
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold text-gray-600">EQ 지수 (에이전트 분석)</p>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-[10px] font-bold text-gray-500">
            <span>{r.label}</span>
            <span className="tabular-nums text-sky-700">{r.value}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${r.color} transition-all duration-500`}
              style={{ width: `${r.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

type SheetKind = 'report' | 'coaching' | null

type Props = {
  childId: string
}

export default function ParentAgentHomeCards({ childId }: Props) {
  const [row, setRow] = useState<AgentLatestReportRow | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState<SheetKind>(null)
  /** 서버 렌더 중 호출을 막기 위해 공개 환경변수 URL만 클라이언트에서 읽습니다. */
  const agentBaseUrl = process.env.NEXT_PUBLIC_AGENT_URL?.trim()?.replace(/\/$/, '') ?? ''

  const load = useCallback(async () => {
    if (!childId || !agentBaseUrl) {
      /** URL 미설정이면 네트워크를 치지 않고 즉시 폴백 카드로 렌더링합니다. */
      setRow(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      /** 서버 fetch 없이 클라이언트에서만 비동기로 가져옵니다. */
            // ✅ 수정 (5초 timeout)
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 5000)
      const data = await fetch(
        `${agentBaseUrl}/agent-a/latest?child_id=${encodeURIComponent(childId)}`,
        { signal: controller.signal }
      )
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
        .finally(() => window.clearTimeout(timeoutId))
      setRow((data as AgentLatestReportRow | null) ?? null)
    } catch {
      /** 에이전트가 느리거나 404여도 홈 전체는 계속 그려야 하므로 폴백 카드로 유지합니다. */
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [agentBaseUrl, childId])

  useEffect(() => {
    void load()
  }, [load])

  const hasContent = Boolean(
    row &&
      (String(row.report_text ?? '').trim().length > 0 || String(row.coaching_text ?? '').trim().length > 0),
  )

  const showCollecting = !loading && (!row || !hasContent)

  const reportFull = String(row?.report_text ?? '').trim()
  const coachingFull = String(row?.coaching_text ?? '').trim()

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-sky-100 bg-white/80 py-6 shadow-sm">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-500"
            aria-hidden
          />
          <span className="text-xs font-bold text-sky-800">AI 요약 불러오는 중…</span>
        </div>
      ) : null}

      {showCollecting && !loading ? (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-sky-50 to-violet-50 p-4 shadow-sm ring-1 ring-white/80">
          <p className="text-center text-sm font-black text-gray-800">🌱 데이터 모으는 중</p>
          <p className="mt-2 text-center text-[11px] font-semibold leading-relaxed text-gray-600">
            미션을 7일 이상 진행하면 AI 분석이 시작돼요!
          </p>
        </div>
      ) : null}

      {!loading && hasContent ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSheet('report')}
            className="group flex flex-col rounded-2xl bg-gradient-to-br from-amber-100/90 via-orange-50 to-rose-50 p-4 text-left shadow-md ring-1 ring-amber-100/80 transition active:scale-[0.99]"
          >
            <span className="text-xs font-black text-amber-950">📊 AI 인사이트 리포트</span>
            <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-snug text-amber-900/90">
              {previewLine(row?.report_text)}
            </p>
            <span className="mt-3 text-[10px] font-bold text-amber-700/80">탭해서 전체 보기 →</span>
          </button>

          <button
            type="button"
            onClick={() => setSheet('coaching')}
            className="group flex flex-col rounded-2xl bg-gradient-to-br from-sky-100/90 via-indigo-50 to-violet-50 p-4 text-left shadow-md ring-1 ring-sky-100/80 transition active:scale-[0.99]"
          >
            <span className="text-xs font-black text-sky-950">💡 경제 습관 코칭 가이드</span>
            <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-snug text-sky-900/90">
              {previewLine(row?.coaching_text)}
            </p>
            <span className="mt-3 text-[10px] font-bold text-sky-700/80">탭해서 전체 보기 →</span>
          </button>
        </div>
      ) : null}

      <ParentAgentBottomSheet
        open={sheet === 'report'}
        title="AI 인사이트 리포트"
        onClose={() => setSheet(null)}
        footer={
          <Link
            href="/parent/routine#parent-routine-special-missions"
            className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 py-3 text-center text-xs font-black text-white shadow-md ring-1 ring-amber-300/50 active:scale-[0.99]"
            onClick={() => setSheet(null)}
          >
            스페셜 미션 제안하기
          </Link>
        }
      >
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-800">{reportFull || '내용이 없습니다.'}</p>
        <div className="mt-4 rounded-xl bg-sky-50/60 p-3 ring-1 ring-sky-100">
          <EqScoreBars eq={row?.eq_scores as AgentEqScores | null} />
        </div>
      </ParentAgentBottomSheet>

      <ParentAgentBottomSheet
        open={sheet === 'coaching'}
        title="경제 습관 코칭 가이드"
        onClose={() => setSheet(null)}
        footer={
          <Link
            href="/parent/approval#parent-approval-market-rewards"
            className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 py-3 text-center text-xs font-black text-white shadow-md ring-1 ring-sky-300/50 active:scale-[0.99]"
            onClick={() => setSheet(null)}
          >
            특별 보상 설정하기
          </Link>
        }
      >
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-800">
          {coachingFull || '내용이 없습니다.'}
        </p>
      </ParentAgentBottomSheet>
    </div>
  )
}
