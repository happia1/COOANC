/**
 * 루틴 도우미 — 이미지를 `/agent-b/parse` 로 보냈을 때 실패하면,
 * HTTP 상태 코드와 응답 본문 문자열로 429 / 503 / 기타를 나눠 채팅 말풍선 문구를 고릅니다.
 * (비개발자: “한도 초과”와 “서버가 바쁨”은 안내 문장을 다르게 보여 줍니다.)
 */

export type RoutineAgentImageParseErrorKind = 'rate_limit' | 'server_busy' | 'generic'

const MSGS: Record<RoutineAgentImageParseErrorKind, string> = {
  rate_limit: `오늘 이미지 분석 사용량이 
모두 소진됐어요.
내일 다시 시도해주세요.

텍스트로 직접 입력하시면
지금 바로 일정을 등록할 수 있어요!`,
  server_busy: `지금 잠시 서버가 혼잡해요.
1~2분 후 다시 시도해주세요.`,
  generic: `이미지 분석 중 오류가 발생했어요.
텍스트로 직접 입력해주시면
바로 등록해드릴게요.`,
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
  /** 429: 상태 코드, 본문의 429, Gemini 할당량·요청 과다 키워드 */
  if (
    httpStatus === 429 ||
    d.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    (lower.includes('429') && lower.includes('too many'))
  ) {
    return 'rate_limit'
  }
  /** 503: 상태 코드, 본문의 503, 과부하·가용성 문구 */
  if (
    httpStatus === 503 ||
    d.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('high demand') ||
    lower.includes('service unavailable') ||
    lower.includes('"code":503') ||
    lower.includes("'code': 503")
  ) {
    return 'server_busy'
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
