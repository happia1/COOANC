/**
 * COOANC 공식 로고(정적 파일 경로)
 *
 * - 실제 파일: `public/COOANC_Logo.png` (Next.js 는 public 루트를 `/` 로 제공하므로 URL 은 `/COOANC_Logo.png`)
 * - 출처: COOANC 프로젝트에 포함된 브랜드 자산(외부 스톡 이미지 아님). 로그인·온보딩 등에 배치한 기록은 `dev_log.md` 의
 *   `[2026-04-04 Session 2]` 항목을 참고하면 됩니다.
 *
 * 주의: `public/logo.png` 는 별도 파일이라 내용이 다를 수 있습니다. 앱 UI 에서 쓰는 로고는 항상 이 상수(= COOANC_Logo)만
 * 사용하는 것이 맞습니다.
 */
export const AUTH_LOGO_SRC = '/COOANC_Logo.png' as const

/**
 * 부모·자녀 앱 상단바 로고 — 표시 높이 기준으로 컴팩트하게
 * - 이미지 소스는 `AUTH_LOGO_SRC` (= `/COOANC_Logo.png`) 와 동일
 * - Next/Image 의 width·height 는 비율·최적화용, 실제 크기는 className 의 h·max-w 로 맞춤
 */
export const TOPBAR_LOGO_WIDTH = 90
export const TOPBAR_LOGO_HEIGHT = 30
export const TOPBAR_LOGO_CLASSNAME =
  'h-[27px] w-auto max-w-[min(100%,90px)] object-contain' as const
