import { normalizeUuidParam } from '@/lib/normalizeUuid'

/**
 * 부모 「자녀 화면 보기」 진입 URL 을 만듭니다.
 *
 * 비개발자 설명:
 * - 주소에 자녀 id(UUID)가 붙으면 그 아이 기준으로 미리보기 쿠키가 설정됩니다.
 * - id 가 비어 있거나 깨진 값이면 쿼리 없이 `/api/parent/enter-child-ui` 만 쓰고,
 *   서버가 부모에게 연결된 첫 자녀를 골라 줍니다(400 대신 안전한 기본값).
 */
export function parentEnterChildUiHref(childId: string | null | undefined): string {
  const n = normalizeUuidParam(childId)
  if (n) {
    return `/api/parent/enter-child-ui?childId=${encodeURIComponent(n)}`
  }
  return '/api/parent/enter-child-ui'
}

/** 쿠키만 심고 JSON 으로 응답 — 클라이언트 `router.push('/home')` 용 */
export function parentEnterChildUiJsonHref(childId: string | null | undefined): string {
  const base = parentEnterChildUiHref(childId)
  return base.includes('?') ? `${base}&json=1` : `${base}?json=1`
}
