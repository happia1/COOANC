/**
 * 부모 화면에서 자녀 앱으로 넘어가기 전에 `ChildScreen` JS 청크를 미리 받습니다.
 * 비개발자: 「자녀 화면」 버튼을 누르기 전에 필요한 파일을 백그라운드로 받아 두면
 * 전환이 조금 더 빨라집니다. 실패해도 진입 자체는 그대로 동작합니다.
 */

let prefetchStarted = false

export function prefetchChildScreenChunk(): void {
  if (typeof window === 'undefined' || prefetchStarted) return
  prefetchStarted = true
  void import(
    /* webpackChunkName: "child-screen" */
    '@/components/child/ChildScreen'
  ).catch(() => {
    prefetchStarted = false
  })
}

/** 브라우저가 한가할 때 청크를 받습니다 — 홈 탭 로드 직후 등에 사용 */
export function prefetchChildScreenChunkWhenIdle(): void {
  if (typeof window === 'undefined') return
  const run = () => prefetchChildScreenChunk()
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 4000 })
  } else {
    window.setTimeout(run, 800)
  }
}
