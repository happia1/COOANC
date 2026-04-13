/**
 * 루틴 도우미 — 이미지를 `/agent-b/parse` 로 보냈을 때 실패하면,
 * HTTP 상태·응답 JSON(`error: "quota_exceeded"` 등)·본문 문자열로 안내 문구를 고릅니다.
 * (비개발자: 한도·503·쿼터 초과는 같은 “오늘 사용량 소진” 안내로 통일합니다.)
 */

export type RoutineAgentImageParseErrorKind = 'daily_quota' | 'generic'

const DAILY_QUOTA_MSG = `오늘 이미지 분석 사용량이 
모두 소진됐어요.
내일 다시 시도해주세요.

텍스트로 직접 입력하시면
지금 바로 일정을 등록할 수 있어요!`

const MSGS: Record<RoutineAgentImageParseErrorKind, string> = {
  daily_quota: DAILY_QUOTA_MSG,
  generic: `이미지 분석 중 오류가 발생했어요.
텍스트로 직접 입력해주시면
바로 등록해드릴게요.`,
}

/** 에이전트가 주는 `{"error":"quota_exceeded",...}` 형태를 본문에서 찾습니다. */
function detailIndicatesQuotaExceeded(detail: string): boolean {
  if (detail.includes('quota_exceeded')) return true
  try {
    const o = JSON.parse(detail) as { error?: string }
    return o.error === 'quota_exceeded'
  } catch {
    return false
  }
}

/**
 * @param httpStatus `fetch` 의 `res.status`. 본문만 있을 때(HTTP 200 인데 본문에 오류 JSON)는 `null`.
 * @param detail 에러 메시지·JSON 문자열·이벤트 제목/설명 등을 이어 붙인 값
 */
export function classifyRoutineAgentImageParseError(
  httpStatus: number | null,
  detail: string,
): RoutineAgentImageParseErrorKind {
  const d = detail
  const lower = d.toLowerCase()
  /** cooanc-agent 503 + `error: "quota_exceeded"` 또는 503/429 상태 */
  if (httpStatus === 503 || httpStatus === 429 || detailIndicatesQuotaExceeded(d)) {
    return 'daily_quota'
  }
  if (d.includes('429') || lower.includes('resource_exhausted') || lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'daily_quota'
  }
  /** 이전에 503 안내로 쓰이던 Gemini 과부하 문구도 동일(일일 한도) 안내로 통합 */
  if (
    d.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('high demand') ||
    lower.includes('service unavailable') ||
    lower.includes('"code":503') ||
    lower.includes("'code': 503")
  ) {
    return 'daily_quota'
  }
  return 'generic'
}

/** 채팅 AI 말풍선에 넣을 최종 문구 */
export function routineAgentImageParseAssistantMessage(
  httpStatus: number | null,
  detail: string,
): string {
  return MSGS[classifyRoutineAgentImageParseError(httpStatus, detail)]
}
