'use client'

/**
 * Agent A 최신 리포트 훅 — 캐시 우선 + 자동 갱신
 *
 * 동작 흐름:
 *   1. [useLayoutEffect] localStorage 캐시를 화면이 그려지기 전에 동기적으로 적용
 *      → 반복 접속 시 로딩 스피너가 전혀 보이지 않습니다.
 *   2. [useEffect] 백그라운드에서 DB 최신 데이터를 조회해 캐시·화면을 갱신
 *   3. 리포트가 7일 이상 됐고 누적 데이터도 충분하면 LLM을 백그라운드 재실행
 *      (UI 로딩 상태 변경 없이 조용히 진행)
 *   4. 리포트가 전혀 없는 최초 접속에만 전경 로딩 상태로 LLM을 실행합니다.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type AgentLatestReportRow } from '@/lib/agentApi'
import { createClient } from '@/lib/supabase/client'

/** localStorage 캐시 키 접두어 (v2: 만료 방식 변경으로 기존 v1 캐시 자동 무시) */
const CACHE_KEY_PREFIX = 'cooanc_agent_report_cache_v2_'

/** 리포트 자동 갱신 주기: 7일 */
const REPORT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000

/**
 * DB 동기화 쿨다운: 마지막 동기화로부터 이 시간 이내 재접속이면
 * Supabase DB 조회를 건너뛰고 localStorage 캐시를 바로 씁니다.
 * (빠른 반복 접속 시 불필요한 네트워크 요청 방지)
 */
const SYNC_COOLDOWN_MS = 10 * 60 * 1000  // 10분

/**
 * LLM 트리거 쿨다운: 마지막 LLM 실행 요청으로부터 이 시간 이내이면
 * 다시 트리거하지 않습니다. (7일 된 리포트가 있어도 매 접속마다 재실행되는 문제 방지)
 */
const LLM_COOLDOWN_MS = 60 * 60 * 1000  // 1시간

/** DB 조회 select 절 — pollLatestReport 와 동일하게 맞춥니다. */
const REPORT_SELECT =
  'id, child_id, week_start, report_text, coaching_text, eq_scores, suggestions, created_at'

type ReportCache = {
  row: AgentLatestReportRow
  cachedAt: string
  /** 마지막 DB 동기화 시각 (ISO) — SYNC_COOLDOWN_MS 이내 재접속 스킵에 사용 */
  lastSyncAt?: string
  /** 마지막 LLM 트리거 시각 (ISO) — LLM_COOLDOWN_MS 이내 재트리거 방지에 사용 */
  lastLlmAt?: string
}

/** localStorage에서 캐시를 읽습니다. 만료 체크 없이 항상 반환 — 갱신 필요 여부는 row.created_at 으로 판단합니다. */
function readReportCache(childId: string): AgentLatestReportRow | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY_PREFIX + childId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ReportCache
    return parsed.row ?? null
  } catch {
    return null
  }
}

/** localStorage에 리포트 캐시를 저장합니다. 기존 lastSyncAt·lastLlmAt 은 유지합니다. */
function writeReportCache(childId: string, row: AgentLatestReportRow): void {
  if (typeof window === 'undefined') return
  try {
    const key = CACHE_KEY_PREFIX + childId
    let existing: Partial<ReportCache> = {}
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) existing = JSON.parse(raw) as ReportCache
    } catch { /* 무시 */ }
    const cache: ReportCache = {
      row,
      cachedAt: new Date().toISOString(),
      lastSyncAt: existing.lastSyncAt,
      lastLlmAt: existing.lastLlmAt,
    }
    window.localStorage.setItem(key, JSON.stringify(cache))
  } catch {
    // 저장 공간 부족 등 무시
  }
}

/** localStorage에서 캐시 전체 객체(메타 포함)를 읽습니다. */
function readReportCacheFull(childId: string): ReportCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY_PREFIX + childId)
    if (!raw) return null
    return JSON.parse(raw) as ReportCache
  } catch {
    return null
  }
}

/** localStorage 캐시를 삭제합니다. */
function clearReportCache(childId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CACHE_KEY_PREFIX + childId)
  } catch {
    // 무시
  }
}

/** 캐시에 lastSyncAt 을 현재 시각으로 갱신합니다. */
function touchSyncTime(childId: string): void {
  if (typeof window === 'undefined') return
  try {
    const key = CACHE_KEY_PREFIX + childId
    const raw = window.localStorage.getItem(key)
    if (!raw) return
    const cache = JSON.parse(raw) as ReportCache
    cache.lastSyncAt = new Date().toISOString()
    window.localStorage.setItem(key, JSON.stringify(cache))
  } catch { /* 무시 */ }
}

/** 캐시에 lastLlmAt 을 현재 시각으로 갱신합니다. */
function touchLlmTime(childId: string): void {
  if (typeof window === 'undefined') return
  try {
    const key = CACHE_KEY_PREFIX + childId
    const raw = window.localStorage.getItem(key)
    if (!raw) return
    const cache = JSON.parse(raw) as ReportCache
    cache.lastLlmAt = new Date().toISOString()
    window.localStorage.setItem(key, JSON.stringify(cache))
  } catch { /* 무시 */ }
}

/**
 * 리포트의 created_at 을 기준으로 자동 갱신이 필요한지 판단합니다.
 * 7일 이상 된 리포트는 갱신 대상입니다.
 */
function isReportOutdated(row: AgentLatestReportRow): boolean {
  if (!row.created_at) return false
  return Date.now() - new Date(row.created_at).getTime() >= REPORT_REFRESH_MS
}

// ─── 공개 타입 ────────────────────────────────────────────────────────────────

export type ParentAgentRunState =
  | 'idle'
  | 'generating'
  | 'success'
  | 'insufficient'
  | 'error'

export type ParentAgentErrorReason =
  | 'none'
  | 'unauthorized'
  | 'timeout'
  | 'service_unavailable'
  | 'server_error'
  | 'network'
  | 'unknown'

export type UseParentAgentReportResult = {
  /** null = 없음, undefined = 아직 첫 응답 전 */
  row: AgentLatestReportRow | null | undefined
  loading: boolean
  runState: ParentAgentRunState
  errorReason: ParentAgentErrorReason
  distinctDays: number
  /** 수동 재분석 트리거 (에러 재시도·강제 갱신) */
  reload: () => Promise<void>
}

// ─── 훅 본체 ──────────────────────────────────────────────────────────────────

export function useParentAgentReport(
  childId: string | undefined,
  observedDaysWithData = 0,
): UseParentAgentReportResult {
  const [row, setRow] = useState<AgentLatestReportRow | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [runState, setRunState] = useState<ParentAgentRunState>('idle')
  const [errorReason, setErrorReason] = useState<ParentAgentErrorReason>('none')
  const [distinctDays, setDistinctDays] = useState(0)

  /** 컴포넌트 마운트 여부 — 비동기 완료 시 setState 를 안전하게 호출하기 위해 사용합니다. */
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /**
   * observedDaysWithData 를 ref 으로 유지합니다.
   * 콜백 의존성에 포함하지 않아도 최신 값을 읽을 수 있게 해, 불필요한 재실행을 방지합니다.
   */
  const daysRef = useRef(observedDaysWithData)
  useEffect(() => {
    daysRef.current = observedDaysWithData
  }, [observedDaysWithData])

  // ─── STEP 1: 캐시 즉시 적용 (화면 그리기 전, 동기 실행) ─────────────────────
  /**
   * useLayoutEffect 는 브라우저가 화면을 그리기 직전에 동기적으로 실행됩니다.
   * 따라서 캐시가 있으면 로딩 스피너가 전혀 보이지 않고 바로 리포트가 표시됩니다.
   */
  useLayoutEffect(() => {
    if (!childId) {
      setLoading(false)
      setRow(null)
      return
    }
    const cached = readReportCache(childId)
    if (cached) {
      setRow(cached)
      setRunState('success')
      setLoading(false)
    }
  }, [childId])

  // ─── 폴링 헬퍼 ───────────────────────────────────────────────────────────────

  /**
   * LLM 생성 직후 DB 반영이 수 초 늦을 수 있어 주기적으로 재조회합니다.
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
          .select(REPORT_SELECT)
          .eq('child_id', targetChildId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!error && data) return data as AgentLatestReportRow
        await new Promise<void>((resolve) => window.setTimeout(resolve, 2500))
      }
      return null
    },
    [],
  )

  // ─── LLM 실행 ────────────────────────────────────────────────────────────────

  /**
   * /api/agent-a/run 을 호출해 리포트를 생성합니다.
   * background=true 이면 UI 상태(loading·runState)를 변경하지 않고 조용히 실행합니다.
   * background=false 이면 "생성 중…" 상태를 화면에 표시합니다.
   */
  const runLLM = useCallback(
    async (
      targetChildId: string,
      supabase: ReturnType<typeof createClient>,
      { background = false }: { background?: boolean } = {},
    ): Promise<void> => {
      if (!background && mountedRef.current) {
        setRunState('generating')
        setErrorReason('none')
      }

      try {
        const {
          data: { session },
        } = await createClient().auth.getSession()
        const parentId = session?.user?.id ?? ''

        const ctrl = new AbortController()
        const timeoutId = window.setTimeout(() => ctrl.abort(), 120_000)

        const runResponse = await fetch('/api/agent-a/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ child_id: targetChildId, parent_id: parentId }),
          signal: ctrl.signal,
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
            if (e instanceof DOMException && e.name === 'AbortError')
              return { ok: false as const, status: 408, error: 'timeout' }
            return { ok: false as const, status: 0, error: 'network' }
          })
          .finally(() => window.clearTimeout(timeoutId))

        if (!runResponse.ok) {
          if (!background && mountedRef.current) {
            const s = runResponse.status
            if (s === 401 || runResponse.error === 'unauthorized') setErrorReason('unauthorized')
            else if (s === 408 || runResponse.error === 'timeout') setErrorReason('timeout')
            else if (s === 503) setErrorReason('service_unavailable')
            else if (s >= 500) setErrorReason('server_error')
            else if (s === 0 || runResponse.error === 'network') setErrorReason('network')
            else setErrorReason('unknown')
            setRunState('error')
            setRow(null)
          }
          return
        }

        const result = runResponse.data

        if (result.status === 'insufficient_data') {
          if (!background && mountedRef.current) {
            setDistinctDays(result.distinct_days ?? 0)
            // 서버 distinct_days 가 부족해도 홈 계산값이 충분하면 폴링으로 재확인
            if (daysRef.current >= 7) {
              setRunState('generating')
              const recovered = await pollLatestReport(supabase, targetChildId, 45_000)
              if (recovered && mountedRef.current) {
                writeReportCache(targetChildId, recovered)
                setRow(recovered)
                setRunState('success')
                setErrorReason('none')
                return
              }
            }
            setRunState('insufficient')
            setErrorReason('none')
            setRow(null)
          }
          return
        }

        if (result.status === 'success') {
          const fresh = await pollLatestReport(supabase, targetChildId, 90_000)
          if (!mountedRef.current) return
          if (fresh) {
            writeReportCache(targetChildId, fresh)
            setRow(fresh)
            setRunState('success')
            setErrorReason('none')
          } else if (!background) {
            setRunState('error')
            setErrorReason('unknown')
            setRow(null)
          }
          return
        }

        if (!background && mountedRef.current) {
          setRunState('error')
          setErrorReason('unknown')
        }
      } catch {
        if (!background && mountedRef.current) {
          setRunState('error')
          setErrorReason('unknown')
        }
      }
    },
    [pollLatestReport],
  )

  // ─── STEP 2: 백그라운드 DB 동기화 + 자동 갱신 체크 ──────────────────────────

  /**
   * 화면 표시 후 백그라운드에서 DB 최신 데이터를 가져오고,
   * 필요하면 자동으로 새 LLM 분석을 실행합니다.
   *
   * ─ 최적화 포인트 ─
   * 1) SYNC_COOLDOWN_MS(10분) 이내 재접속이면 DB 쿼리를 건너뛰고 캐시를 그대로 씁니다.
   *    → 빠른 반복 접속 시 Supabase 요청이 발생하지 않아 즉시 표시됩니다.
   * 2) LLM_COOLDOWN_MS(1시간) 이내에 이미 트리거했으면 재실행하지 않습니다.
   *    → 7일 된 리포트가 있어도 매 접속마다 LLM이 돌지 않습니다.
   *
   * ─ 일반 흐름 ─
   * - DB에 리포트가 있으면: 캐시·화면을 갱신하고, 7일 이상 됐으면 백그라운드 LLM 재실행
   * - DB에 리포트가 없고(최초 접속), 데이터가 7일 이상 쌓였으면: 전경 LLM 실행
   */
  const backgroundSync = useCallback(async () => {
    if (!childId) {
      if (mountedRef.current) {
        setRow(null)
        setLoading(false)
      }
      return
    }

    // ── SYNC 쿨다운 체크: 최근 동기화했으면 DB 조회 없이 캐시 적용 후 종료 ──
    const fullCache = readReportCacheFull(childId)
    if (fullCache?.lastSyncAt && fullCache.row) {
      const msSinceSync = Date.now() - new Date(fullCache.lastSyncAt).getTime()
      if (msSinceSync < SYNC_COOLDOWN_MS) {
        if (mountedRef.current) {
          setRow(fullCache.row)
          setRunState('success')
          setLoading(false)
        }
        return
      }
    }

    try {
      const supabase = createClient()
      const { data: dbLatest, error } = await supabase
        .from('agent_reports')
        .select(REPORT_SELECT)
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!mountedRef.current) return

      if (!error && dbLatest) {
        const freshRow = dbLatest as AgentLatestReportRow
        writeReportCache(childId, freshRow)
        touchSyncTime(childId)
        setRow(freshRow)
        setRunState('success')
        setLoading(false)

        // ── LLM 쿨다운 체크: 리포트가 7일 이상 됐어도 최근에 이미 트리거했으면 스킵 ──
        if (isReportOutdated(freshRow) && daysRef.current >= 7) {
          const cache = readReportCacheFull(childId)
          const lastLlm = cache?.lastLlmAt ? new Date(cache.lastLlmAt).getTime() : 0
          if (Date.now() - lastLlm >= LLM_COOLDOWN_MS) {
            touchLlmTime(childId)
            void runLLM(childId, supabase, { background: true })
          }
        }
        return
      }

      // DB 에도 리포트가 없는 경우 (최초 접속)
      touchSyncTime(childId)
      setLoading(false)
      const days = daysRef.current
      if (days >= 7) {
        // 데이터가 충분하면 전경 로딩으로 LLM을 최초 실행합니다.
        touchLlmTime(childId)
        await runLLM(childId, supabase, { background: false })
      } else {
        setRunState('insufficient')
        setDistinctDays(days)
        setRow(null)
      }
    } catch {
      if (mountedRef.current) setLoading(false)
    }
  }, [childId, runLLM])

  useEffect(() => {
    void backgroundSync()
  }, [backgroundSync])

  // ─── 수동 재실행 (에러 재시도 / 강제 새 분석) ────────────────────────────────

  const reload = useCallback(async () => {
    if (!childId) return
    // 수동 재분석: 쿨다운 무시하고 캐시 초기화 후 전경 실행
    clearReportCache(childId)
    setErrorReason('none')
    setRunState('idle')
    const supabase = createClient()
    touchLlmTime(childId)
    await runLLM(childId, supabase, { background: false })
  }, [childId, runLLM])

  return { row, loading, runState, errorReason, distinctDays, reload }
}
