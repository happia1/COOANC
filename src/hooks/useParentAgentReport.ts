'use client'

/**
 * Agent A 최신 리포트 1건을 불러오고, 없으면 `/agent-a/run` 으로 생성을 시도합니다.
 * - 부모 홈에서 `EconomicEqPanel`(리포트 카드)과 `ParentAgentHomeCards`(코칭)가 **같은 데이터**를 쓰도록
 *   훅을 한 번만 호출하는 용도입니다(중복 fetch 방지).
 */

import { useCallback, useEffect, useState } from 'react'
import { type AgentLatestReportRow } from '@/lib/agentApi'
import { createClient } from '@/lib/supabase/client'

/** 에이전트 실행 결과 — UI 안내 문구에 씁니다. */
export type ParentAgentRunState =
  | 'idle'
  | 'generating'
  | 'success'
  | 'insufficient'
  | 'error'

/** 에이전트 실패 원인 — 화면 문구를 상태별로 다르게 보여 줄 때 사용합니다. */
export type ParentAgentErrorReason =
  | 'none'
  | 'unauthorized'
  | 'timeout'
  | 'service_unavailable'
  | 'server_error'
  | 'network'
  | 'unknown'

export type UseParentAgentReportResult = {
  /** null = 아직 없음(로딩 끝난 뒤), undefined = 아직 첫 응답 전 */
  row: AgentLatestReportRow | null | undefined
  loading: boolean
  runState: ParentAgentRunState
  errorReason: ParentAgentErrorReason
  distinctDays: number
  /** 첫 조회·재시도·생성 후 갱신에 모두 사용 */
  reload: () => Promise<void>
}

/**
 * Agent A 리포트 훅
 * - observedDaysWithData: 부모 홈 서버가 계산한 최근 14일 누적일수(보정용).
 */
export function useParentAgentReport(
  childId: string | undefined,
  observedDaysWithData = 0,
): UseParentAgentReportResult {
  const [row, setRow] = useState<AgentLatestReportRow | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [runState, setRunState] = useState<ParentAgentRunState>('idle')
  const [errorReason, setErrorReason] = useState<ParentAgentErrorReason>('none')
  const [distinctDays, setDistinctDays] = useState(0)

  /**
   * 생성 API 성공 후 DB 반영이 수 초~수십 초 늦을 수 있어 폴링합니다.
   * 바로 1회 조회만 하면 "준비 완료 메시지인데 리포트 없음" 상태가 반복됩니다.
   */
  const pollLatestReport = useCallback(
    async (
      supabase: ReturnType<typeof createClient>,
      targetChildId: string,
      timeoutMs: number,
    ): Promise<AgentLatestReportRow | null> => {
      const started = Date.now()
      while (Date.now() - started < timeoutMs) {
        const { data, error } = await supabase
          .from('agent_reports')
          .select('id, child_id, week_start, report_text, coaching_text, eq_scores, suggestions, created_at')
          .eq('child_id', targetChildId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!error && data) return data as AgentLatestReportRow
        await new Promise((resolve) => window.setTimeout(resolve, 2500))
      }
      return null
    },
    [],
  )

  const reload = useCallback(async () => {
    if (!childId) {
      setRow(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setRunState('idle')
    setErrorReason('none')
    try {
      const supabase = createClient()
      // /agent-a/latest 의 404/스키마 의존을 제거하고, 프론트는 DB 최신 1건을 직접 조회합니다.
      const { data: dbLatest, error: dbErr } = await supabase
        .from('agent_reports')
        .select('id, child_id, week_start, report_text, coaching_text, eq_scores, suggestions, created_at')
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!dbErr && dbLatest) {
        setRow(dbLatest as AgentLatestReportRow)
        setRunState('success')
        setLoading(false)
        return
      }

      setLoading(false)
      setRunState('generating')
      const {
        data: { session },
      } = await createClient().auth.getSession()
      const parentId = session?.user?.id ?? ''

      const runCtrl = new AbortController()
      const runTimeout = window.setTimeout(() => runCtrl.abort(), 120_000)
      // 브라우저 -> 같은 오리진 Next API를 먼저 호출해 CORS/콜드스타트 영향을 줄입니다.
      const runResponse = await fetch('/api/agent-a/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ child_id: childId, parent_id: parentId }),
        signal: runCtrl.signal,
      })
        .then(async (res) => {
          const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>
          if (!res.ok) {
            return {
              ok: false as const,
              status: res.status,
              error:
                typeof payload.error === 'string'
                  ? payload.error
                  : typeof payload.detail === 'string'
                    ? payload.detail
                    : '',
            }
          }
          return {
            ok: true as const,
            data: payload as { status: string; distinct_days?: number },
          }
        })
        .catch((e: unknown) => {
          // AbortError 는 "2분 타임아웃"으로 간주해 별도 문구를 보여 줍니다.
          if (e instanceof DOMException && e.name === 'AbortError') {
            return { ok: false as const, status: 408, error: 'timeout' }
          }
          return { ok: false as const, status: 0, error: 'network' }
        })
        .finally(() => window.clearTimeout(runTimeout))

      if (!runResponse.ok) {
        if (runResponse.status === 401 || runResponse.error === 'unauthorized') {
          setErrorReason('unauthorized')
        } else if (runResponse.status === 408 || runResponse.error === 'timeout') {
          setErrorReason('timeout')
        } else if (runResponse.status === 503 || runResponse.error === 'service_unavailable') {
          setErrorReason('service_unavailable')
        } else if (runResponse.status >= 500) {
          setErrorReason('server_error')
        } else if (runResponse.status === 0 || runResponse.error === 'network') {
          setErrorReason('network')
        } else {
          setErrorReason('unknown')
        }
        setRunState('error')
        setRow(null)
        return
      }
      const runResult = runResponse.data

      if (runResult.status === 'insufficient_data') {
        setDistinctDays(runResult.distinct_days ?? 0)
        // 서버 distinct_days 는 0인데 홈 계산 누적일수는 충분한 경우가 있어 재검증합니다.
        if (observedDaysWithData >= 7) {
          setRunState('generating')
          const recovered = await pollLatestReport(supabase, childId, 45_000)
          if (recovered) {
            setRow(recovered)
            setRunState('success')
            setErrorReason('none')
            return
          }
        }
        setRunState('insufficient')
        setErrorReason('none')
        setRow(null)
        return
      }

      if (runResult.status === 'success') {
        // 성공 응답 뒤 DB 반영 지연을 고려해 최대 90초까지 재조회합니다.
        const fresh = await pollLatestReport(supabase, childId, 90_000)
        setRow(fresh ?? null)
        setErrorReason(fresh ? 'none' : 'unknown')
        setRunState(fresh ? 'success' : 'error')
        return
      }

      setErrorReason('unknown')
      setRunState('error')
      setRow(null)
    } catch {
      setErrorReason('unknown')
      setRunState('error')
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [childId, observedDaysWithData, pollLatestReport])

  useEffect(() => {
    void reload()
  }, [reload])

  return { row, loading, runState, errorReason, distinctDays, reload }
}
