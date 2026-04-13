/**
 * COOANC Railway 에 올라간 FastAPI 에이전트와 통신합니다.
 * - 브라우저에서 직접 호출하므로 URL 은 `NEXT_PUBLIC_*` 만 사용합니다(서버 전용 비밀이 아님).
 * - 에이전트 `main.py` 에서 CORS 가 열려 있어야 합니다.
 */

/** 배포 기본값 — 로컬에서는 `.env.local` 의 NEXT_PUBLIC_AGENT_URL 로 덮어씁니다. */
const DEFAULT_AGENT_URL = 'https://cooanc-agent.onrender.com'

/** 환경변수가 비어 있으면 프로덕션 기본 URL 로 폴백합니다(로컬에서 .env 없이도 동작 확인용). */
export function getAgentBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_AGENT_URL?.trim()
  return raw && raw.length > 0 ? raw.replace(/\/$/, '') : DEFAULT_AGENT_URL
}

/** Supabase `agent_reports` 한 행과 동일한 필드를 기대합니다. */
export type AgentLatestReportRow = {
  id: string
  child_id: string
  week_start: string
  report_text: string | null
  coaching_text: string | null
  eq_scores: AgentEqScores | null
  suggestions?: unknown
  created_at?: string
}

export type AgentEqScores = {
  delay_satisfaction?: number
  save_ratio?: number
  routine_completion?: number
}

export type AgentParseEvent = {
  type: string
  title: string
  start_date: string
  end_date: string | null
  /** 서버가 넣는 설명(다건 커밋 후에도 올 수 있음) */
  description?: string
  /** 이미지 1회 파싱 등에서만 올 수 있음 — 커밋 시 routine_off 제안 생성에 씁니다 */
  routine_off?: boolean
}

/** 에이전트가 `type`/`schedules_api` 로 주는 경우를 프론트 `mode`/`schedules` 로 맞출 때 씁니다. */
export type AgentParseApiRow = {
  title?: string
  start_date?: string
  end_date?: string | null
  event_type?: string
  type?: string
  description?: string
  note?: string
  routine_off?: boolean
}

export type AgentParseSuggestion = {
  type: string
  detail: string
  suggestion_id: string | null
}

/** `single`: 바로 DB에 초안이 저장됨. `multi`: 스캔만 하고 한 건씩 commit API 로 저장 */
export type AgentParseMode = 'single' | 'multi'

export type AgentParsedScheduleRow = {
  event: AgentParseEvent
  suggestions: AgentParseSuggestion[]
  /** `public_holidays` 와 겹쳐 유형·루틴이 자동 조정됐는지(다건 슬롯 카드 안내용) */
  holiday_auto_from_public?: boolean
}

export type AgentParseResponse = {
  /** 서버 최신 응답과의 호환 (`mode` 와 동일 역할) */
  type?: 'single' | 'multi'
  count?: number
  /** 원본 추출 행(학사일정표 등) — `schedules` 가 없을 때 UI 가 맞출 수 있음 */
  schedules_api?: AgentParseApiRow[] | null
  mode: AgentParseMode
  /** 다건일 때만 채워짐 — 각 줄은 처음엔 suggestions 가 비어 있고, ‘등록’ 후 채워짐 */
  schedules: AgentParsedScheduleRow[] | null
  event: AgentParseEvent
  suggestions: AgentParseSuggestion[]
  saved_event_id: string | null
  /** 법정 공휴일(`public_holidays`)과 겹쳐 휴일·루틴 끔을 자동 적용했는지 */
  holiday_auto_applied?: boolean
}

/** POST /agent-b/commit-schedule 한 건 저장 응답(모드 필드 없음) */
export type AgentCommitScheduleResponse = {
  event: AgentParseEvent
  suggestions: AgentParseSuggestion[]
  saved_event_id: string | null
}

/** 최근 AI 리포트 1건 — 없으면 null(404 등). */
export async function fetchAgentLatestReport(childId: string): Promise<AgentLatestReportRow | null> {
  const base = getAgentBaseUrl()
  const url = `${base}/agent-a/latest?child_id=${encodeURIComponent(childId)}`
  const res = await fetch(url, { method: 'GET', cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t || `에이전트 오류 (${res.status})`)
  }
  return (await res.json()) as AgentLatestReportRow
}

/** 일정 텍스트/이미지 파싱 + 제안 생성 */
export async function postAgentParse(body: {
  family_link_id: string
  child_id: string
  input_type: 'text' | 'image'
  text_input?: string
  image_base64?: string
}): Promise<AgentParseResponse> {
  const base = getAgentBaseUrl()
  const res = await fetch(`${base}/agent-b/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const detail = typeof json.detail === 'string' ? json.detail : JSON.stringify(json)
    throw new Error(detail || `파싱 실패 (${res.status})`)
  }
  return json as unknown as AgentParseResponse
}

/** 다건 스캔 후, 한 건의 일정만 서버(DB)에 확정 저장하고 루틴 제안을 생성합니다. */
export async function postAgentCommitSchedule(body: {
  family_link_id: string
  child_id: string
  input_type: 'text' | 'image'
  text_input?: string
  event: AgentParseEvent
}): Promise<AgentCommitScheduleResponse> {
  const base = getAgentBaseUrl()
  const res = await fetch(`${base}/agent-b/commit-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const detail = typeof json.detail === 'string' ? json.detail : JSON.stringify(json)
    throw new Error(detail || `저장 실패 (${res.status})`)
  }
  return json as unknown as AgentCommitScheduleResponse
}

/** 제안 승인 또는 거절 */
export async function postAgentApprove(suggestionId: string, action: 'approved' | 'rejected'): Promise<void> {
  const base = getAgentBaseUrl()
  const res = await fetch(`${base}/agent-b/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suggestion_id: suggestionId, action }),
  })
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(json.detail || `처리 실패 (${res.status})`)
  }
}
