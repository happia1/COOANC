'use client'

/**
 * Agent A 최신 리포트 1건을 불러오고, 없으면 `/agent-a/run` 으로 생성을 시도합니다.
 * - 부모 홈에서 `EconomicEqPanel`(리포트 카드)과 `ParentAgentHomeCards`(코칭)가 **같은 데이터**를 쓰도록
 *   훅을 한 번만 호출하는 용도입니다(중복 fetch 방지).
 */

import { useCallback, useEffect, useState } from 'react'
import { getAgentBaseUrl, type AgentLatestReportRow } from '@/lib/agentApi'
import { createClient } from '@/lib/supabase/client'

/** 에이전트 실행 결과 — UI 안내 문구에 씁니다. */
export type ParentAgentRunState =
  | 'idle'
  | 'generating'
  | 'success'
  | 'insufficient'
  | 'error'

export type UseParentAgentReportResult = {
  /** null = 아직 없음(로딩 끝난 뒤), undefined = 아직 첫 응답 전 */
  row: AgentLatestReportRow | null | undefined
  loading: boolean
  runState: ParentAgentRunState
  distinctDays: number
  /** 첫 조회·재시도·생성 후 갱신에 모두 사용 */
  reload: () => Promise<void>
}

export function useParentAgentReport(childId: string | undefined): UseParentAgentReportResult {
  const [row, setRow] = useState<AgentLatestReportRow | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [runState, setRunState] = useState<ParentAgentRunState>('idle')
  const [distinctDays, setDistinctDays] = useState(0)

  const reload = useCallback(async () => {
    if (!childId) {
      setRow(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setRunState('idle')
    const agentBaseUrl = getAgentBaseUrl()
    try {
      const getCtrl = new AbortController()
      const getTimeout = window.setTimeout(() => getCtrl.abort(), 15_000)
      const existing = await fetch(
        `${agentBaseUrl}/agent-a/latest?child_id=${encodeURIComponent(childId)}`,
        { signal: getCtrl.signal },
      )
        .then((res) => (res.ok ? (res.json() as Promise<AgentLatestReportRow>) : null))
        .catch(() => null)
        .finally(() => window.clearTimeout(getTimeout))

      if (existing) {
        setRow(existing)
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
      const runResult = await fetch(`${agentBaseUrl}/agent-a/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId, parent_id: parentId }),
        signal: runCtrl.signal,
      })
        .then((res) => (res.ok ? (res.json() as Promise<{ status: string; distinct_days?: number }>) : null))
        .catch(() => null)
        .finally(() => window.clearTimeout(runTimeout))

      if (!runResult) {
        setRunState('error')
        setRow(null)
        return
      }

      if (runResult.status === 'insufficient_data') {
        setDistinctDays(runResult.distinct_days ?? 0)
        setRunState('insufficient')
        setRow(null)
        return
      }

      if (runResult.status === 'success') {
        const newGet = new AbortController()
        const newTimeout = window.setTimeout(() => newGet.abort(), 10_000)
        const fresh = await fetch(
          `${agentBaseUrl}/agent-a/latest?child_id=${encodeURIComponent(childId)}`,
          { signal: newGet.signal },
        )
          .then((res) => (res.ok ? (res.json() as Promise<AgentLatestReportRow>) : null))
          .catch(() => null)
          .finally(() => window.clearTimeout(newTimeout))
        setRow(fresh ?? null)
        setRunState(fresh ? 'success' : 'error')
        return
      }

      setRunState('error')
      setRow(null)
    } catch {
      setRunState('error')
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { row, loading, runState, distinctDays, reload }
}
