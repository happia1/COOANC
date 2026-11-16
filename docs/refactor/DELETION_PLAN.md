# 삭제 계획 (승인 대기 — 아직 아무것도 삭제하지 않음)

확인 방법: `src`, `tests`, `scripts`, `middleware.ts`, `next.config.mjs` 전체에서 이름·경로 참조 검색. 21개 모두 다른 코드의 import가 0이다. (ChildNavBar, MissionSleepMorningLayer는 주석에 이름만 남아 있고 코드 참조는 없음)

## A. 파일 21개 (약 2,300줄)

| 파일 | 줄 | 과거 용도(이력 기준) |
|---|---|---|
| `child/ChildNavBar.tsx` | 136 | 옛 자녀 하단 내비 (layout 주석에 "제거했습니다") |
| `child/ChildSceneryTopPills.tsx` | 146 | 옛 홈 상단 알약 |
| `child/NavigationMapSheet.tsx` | 148 | 옛 지도 이동 시트 |
| `child/MissionSleepMorningLayer.tsx` | 470 | 옛 수면·아침 알람 레이어 (`ChildAlarmClockPopup`이 대체) |
| `child/MarketWishlistBottomSheet.tsx` | 236 | 위시리스트 (10/25 triage에서 "미운영이면 제거 후보") |
| `parent/ParentSettingsChildrenSection.tsx` | 274 | 옛 설정 자녀 섹션 |
| `parent/ChildOnboardingSurvey.tsx` | 319 | 옛 자녀 온보딩 설문 |
| `parent/ChildSwitcher.tsx`, `ChildAccountCard.tsx` | 52, 46 | 옛 자녀 전환/카드 |
| `parent/ParentAgentBottomSheet.tsx` | 76 | 옛 에이전트 시트 |
| `settings/MissionSuggestCard.tsx` | 99 | 미션 추천 카드 |
| `sprites/` Balloon·Banner·Congrats·Farm·Icon·Item·MissionSprite | 17~47 | 스프라이트 래퍼 7개 |
| `constants/effectsBalloonsAtlas.ts` | 18 | 사용 안 되는 상수 |
| `lib/supabase/authSessionSingleFlight.ts` | 23 | 인증 단일 호출 (현재 방식으로 대체됨) |
| `lib/supabase/serviceRoleEnv.ts` | 35 | 서비스 롤 환경 헬퍼 ⚠ 보안 관련 — 삭제 전 현재 서비스 롤 경로와 중복인지 확인 |

함께 정리: 위 파일 이름만 언급하는 주석 3곳(`ChildAlarmClockPopup.tsx:123`, `ChildScreen.tsx:2706`, `(child)/layout.tsx:34`).

## B. API 라우트 8개 (호출처가 저장소 어디에도 없음)

`/api/market/wishlist`, `/api/market/reset-child-hidden-items`, `/api/mission/toggle`, `/api/mission/clone-template`, `/api/mission/patch-schedule`, `/api/content/resolve-embed`, `/api/calendar-event/checklist`, `/api/auth/session`

- 외부(AI 에이전트 서비스 등)가 호출할 가능성은 저장소만으로 확인 불가. **외부 서비스가 이 API를 부르는지 알려주면 확정**한다.
- `/auth/callback`은 로그인 리다이렉트이므로 **삭제하지 않는다.**

## C. 삭제하지 않는 것
- DB 테이블·마이그레이션·기존 데이터 (위시리스트 테이블 포함)
- 미사용 export 168개(함수 단위)는 파일 정리 후 별도 단계에서 목록으로 제시
- 에셋(`public/`)은 화면에서 사용 여부를 확인한 뒤 별도 승인

## 실행 방식 (승인 시)
1. 지금 상태에서 `npm run build` 통과 확인
2. A 삭제 → `tsc` 확인 → 커밋 1개
3. B 삭제 → `tsc` 확인 → 커밋 1개
4. `PROGRESS.md`에 기록, 되돌리려면 커밋 하나만 `git revert`
