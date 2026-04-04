/**
 * fetch 응답 본문을 안전하게 JSON으로 읽습니다.
 * - 빈 본문이면 res.json() 이 "Unexpected end of JSON input" 을 내는 것을 피합니다.
 * - HTML 에러 페이지 등 비JSON이면 parse 실패로 data 는 null 입니다.
 */
export async function parseJsonFromResponse<T = Record<string, unknown>>(
  res: Response,
): Promise<{ data: T | null; parseError: boolean }> {
  const text = await res.text()
  if (!text.trim()) {
    return { data: null, parseError: false }
  }
  try {
    return { data: JSON.parse(text) as T, parseError: false }
  } catch {
    return { data: null, parseError: true }
  }
}
