/**
 * 부모 계정으로 로그인한 채, 자녀가 보는 화면(/home, /mission …)을 열 때 쓰는 쿠키 이름입니다.
 * - HttpOnly 로 자바스크립트에서 읽을 수 없어, XSS 로 쿠키를 훔치기 어렵습니다.
 * - 값은 연결된 자녀 profiles.id (UUID) 한 개입니다.
 */
export const PARENT_AS_CHILD_COOKIE = 'cooanc_parent_as_child'

/** 쿠키 유지 시간(초) — 하루. 나가기 누르면 바로 삭제됩니다. */
export const PARENT_AS_CHILD_COOKIE_MAX_AGE = 60 * 60 * 24
