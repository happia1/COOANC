/**
 * COOANC 공식 로고(정적 파일 경로)
 *
 * - 실제 파일: `public/COOANC_Logo.png` (Next.js 는 public 루트를 `/` 로 제공하므로 URL 은 `/COOANC_Logo.png`)
 * - 출처: COOANC 프로젝트에 포함된 브랜드 자산(외부 스톡 이미지 아님). 로그인·온보딩 등에 배치한 기록은 `dev_log.md` 의
 *   `[2026-04-04 Session 2]` 항목을 참고하면 됩니다.
 *
 * 주의: `public/logo.png` 는 별도 파일이라 내용이 다를 수 있습니다. 로그인·가입·온보딩 같은 가로형 로고 화면은 이 상수를,
 * 부모·자녀 앱 상단바는 `TOPBAR_LOGO_SRC`(탭 파비콘과 **같은 그림**의 복사본, `public/assets/...` 경로)를 씁니다.
 */
export const AUTH_LOGO_SRC = '/COOANC_Logo.png' as const

/**
 * 브라우저 탭 파비콘(`public/favicon-96x96.png`)과 **동일 바이너리**를 복사해 둔 경로입니다.
 * - Next.js 16 은 루트 `/favicon-96x96.png` 를 `next/image` 의 `localPatterns` 에서 자주 막으므로,
 *   이미 허용된 `/assets/**` 아래(`public/assets/img/brand/favicon-96x96.png`)에 두고 UI 에서만 씁니다.
 * - 탭 아이콘을 바꿀 때는 `public/favicon-96x96.png` 와 이 파일을 **같이** 갈아끼우세요.
 * - 로그인·온보딩은 가로형 `AUTH_LOGO_SRC` 를 쓰고, 앱 상단·루틴 도우미 등 작은 마크는 이 상수로 맞춥니다.
 */
export const TOPBAR_LOGO_SRC = '/assets/img/brand/favicon-96x96.png' as const

/**
 * 부모·자녀 앱 상단바 로고 — 파비콘(정사각형)을 작게 보이게
 * - `next/image` 의 width·height 는 비율·최적화용, 실제 보이는 크기는 className 의 h·w 로 맞춤
 */
export const TOPBAR_LOGO_WIDTH = 32
export const TOPBAR_LOGO_HEIGHT = 32
export const TOPBAR_LOGO_CLASSNAME = 'h-8 w-8 shrink-0 object-contain' as const
