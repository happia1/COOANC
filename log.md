# 2026-05-31 작업 로그

## 오늘 한 일
- **부모 ↔ 자녀 화면 전환 UX**: 클릭 직후 루트 전역 오버레이(자녀 키즈룸 / 부모 그라데이션) → `enter-child-ui`·`exit-child-ui` JSON API → `router.push` 로 **이중 새로고침·깜빡임** 제거.
- **자동 로그인**: `/api/auth/post-login-redirect` 로 목적지 1회 결정, `child-entry`·`/` 연쇄 리다이렉트 축소.
- **로딩 UI**: `TabTransitionSkeleton` 통일, 루트 `loading.tsx` null, 나가기/진입 중 중복 스켈레톤 생략.
- **안정성**: `ChildHomeScreenClient` 로 `ChildScreen` chunk 분리; dev `ChunkLoadError` 시 `.next` 재생성 가이드 정리.
- **정리**: 디버그 instrumentation 제거.

## 커밋/배포
- `35b90f9` — `feat(app): 부모-자녀 화면 전환·자동 로그인 경로 UX 개선` (`main` push 완료)

## 메모
- 전환 상태·오버레이: `src/components/child/ChildEnterTransitionProvider.tsx`
- 진입 링크: `ParentEnterChildUiLink.tsx` / 나가기: `ChildScreen.tsx` + `ParentExitTransitionEnd.tsx`
- 로그인 후 분기: `resolvePostLoginRedirect.ts`, `pickPostLoginNavigationTarget.ts`
- dev 서버 **실행 중**에는 `.next` 폴더 삭제하지 말 것 (webpack 캐시 손상 → ChunkLoadError)

## 다음에 이어서
- Vercel·실기기에서 전환·자동 로그인 최종 확인
- 필요 시 Supabase 플랜/쿼리 부하 점검
