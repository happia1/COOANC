# 진단 보고서 (2026-11-16)

> 코드는 한 줄도 바꾸지 않았다. 확인 방법과 확실성을 항목마다 적었다.
> 확실성: **확인됨**(직접 실행·검색으로 확인) / **추정**(정적 분석, 사람이 최종 확인 필요)

## 1. 한눈에 보기

| 영역 | 상태 | 판단 |
|---|---|---|
| 타입 검사 (`tsc --noEmit`) | 오류 0 | 양호 |
| 프로덕션 빌드 | 컴파일·타입 통과, 정적 페이지 생성에서 중단 | 환경변수 없는 이 환경의 한계. 코드 문제 아님 |
| 린트 | **동작 안 함** | `npm run lint`가 `next lint`인데 Next 16에서 제거됨. ESLint 설정 파일도 없음 |
| 자동 테스트 | 있음(`tests/`) | 아직 실행하지 않음. 부분 커버리지로 보임 |
| 코드 규모 | TS/TSX 366개, 약 6.4만 줄, main 커밋 467개 (2026-03-31~) | 처음 "58개"는 얕은 복제 때문에 잘못 센 값 — 정정 |
| 문서 최신성 | 핵심 5종 마지막 수정 2026-08-18 | 이후 커밋 59개, 3개월 공백 |
| 작업 기록 | `dev_log.md` 마지막 항목 2026-10-25 | 11월 커밋 다수(마케팅 사이트)는 기록 없음 |

## 2. 지침 (정리 완료)

- `AI_INSTRUCTIONS.md`에 규칙이 있었지만 어디서도 자동으로 읽히지 않았다. `CLAUDE.md`는 없었다. → **확인됨**
- 지침이 "Next.js 15"라 했으나 실제는 Next 16.2.2, React 19, TypeScript 6. → **확인됨**
- "/docs의 모든 문서를 읽어라"는 규칙은 현실적이지 않다(docs 53MB, 대부분 낡음). 코드와 dev_log가 더 최신이다.
- 조치: 루트 `CLAUDE.md`에 통합하고 `AI_INSTRUCTIONS.md`는 안내 문서로 축소했다. 지침 충돌 시 코드를 기준으로 한다는 원칙을 넣었다.

## 3. 문서와 현실의 차이 (확인된 것)

| 문서 | 문서의 내용 | 현실 | 확실성 |
|---|---|---|---|
| `00_overview.md` | "실제 서비스 테이블 미생성", 에셋 작업 중 | 마이그레이션 161개, 운영 DB 사용 중 | 확인됨 |
| IA 3.1 | 부모 UI 4탭: 홈, 루틴 매니저, 승인&큐레이션, 커뮤니티 | 하단 탭은 홈·루틴·승인 3개. 커뮤니티 없음 | 확인됨 |
| IA/PRD | LangGraph 기반 스케줄·코칭 에이전트가 앱 안에 있음 | 이 저장소에는 LangGraph 코드 없음. 외부 서비스(`NEXT_PUBLIC_AGENT_URL`)를 호출 | 확인됨 (외부 서비스 저장소는 확인 불가) |
| IA 3.1.1 | 홈에 AI 행동 분석 요약, 경제 EQ 지수 | `EconomicEqPanel`은 있으나 AI 분석 요약은 미확인 | 추정 |
| IA 6.3 | 일정은 휴일·기념일 중심 | 일정 분류 6종, 루틴 2종(주중/주말·휴일)으로 개편됨 (dev_log 8/1) | 확인됨 (dev_log 기준) |
| 신규 | 문서에 없음 | 마케팅 사이트(`public/site`, 147개 파일), 화분·저금통(`credits_available`), 콘텐츠 티켓, 집게 게임(`clawMachine`) | 확인됨 |

다음 단계에서 PRD·IA·디자인 가이드·master_doc을 항목별로 전수 대조해 차이표를 완성해야 한다(아직 5개 중 IA 일부만 대조).

## 4. 쓰이지 않는 코드

### 4-1. 어디서도 import되지 않는 파일 21개, 약 2,300줄 (추정)
저장소 전체(src, tests, scripts, middleware)에서 파일명 참조가 0이다. 동적 import는 이름 문자열로 함께 검색했다.

| 묶음 | 파일 | 줄 |
|---|---|---|
| 구 자녀 화면 부품 | `ChildNavBar`, `ChildSceneryTopPills`, `NavigationMapSheet`, `MissionSleepMorningLayer` | 136, 146, 148, 470 |
| 마켓 위시리스트 | `MarketWishlistBottomSheet` | 236 |
| 구 부모 설정/온보딩 | `ParentSettingsChildrenSection`, `ChildOnboardingSurvey`, `ChildSwitcher`, `ChildAccountCard`, `ParentAgentBottomSheet` | 274, 319, 52, 46, 76 |
| 설정 | `settings/MissionSuggestCard` | 99 |
| 스프라이트 래퍼 | `sprites/` 안 Balloon·Banner·Congrats·Farm·Icon·Item·MissionSprite | 17~47 |
| 상수·유틸 | `effectsBalloonsAtlas.ts`, `authSessionSingleFlight.ts`, `serviceRoleEnv.ts` | 18, 23, 35 |

- `dev_log`에 따르면 `ChildNavBar`, `MissionSleepMorningLayer`, `ChildSwitcher`는 과거에 쓰이다가 교체된 것으로 보인다.
- `serviceRoleEnv.ts`는 보안 민감 파일이다. 삭제 전에 서비스 롤 키를 다루는 다른 경로와 중복인지 확인이 필요하다.

### 4-2. 호출처가 없는 API 라우트 9개 / 전체 80개 (추정)
`/api/auth/session`, `/api/content/resolve-embed`, `/api/mission/patch-schedule`, `/api/mission/clone-template`, `/api/mission/toggle`, `/api/calendar-event/checklist`, `/api/market/reset-child-hidden-items`, `/api/market/wishlist`, `/auth/callback`
- `/auth/callback`은 로그인 리디렉션으로 외부에서 호출될 수 있어 **삭제 금지 후보**다. 나머지도 외부(앱 밖) 호출 여부를 확인하기 전에는 삭제하지 않는다.
- `/api/market/wishlist`와 `MarketWishlistBottomSheet`는 같은 기능 묶음이다. `triage-2026-10-25`에 이미 "미운영이면 제거 후보"라고 기록되어 있다.

### 4-3. 쓰이지 않는 export 168개 (추정, 오탐 가능)
특히 많은 곳: `missionTodayLayoutSpec.ts` 26개, `plantTrees.ts` 10, `youtubeContent.ts` 10, `piggyBankStages.ts` 9, `piggyBankBonus.ts` 8, `clawMachine.ts` 7. 기능이 더 있었다가 단순화된 흔적이다.

### 4-4. 에셋
`public/` 86MB, 539개 파일. 소스에서 경로 문자열로 참조되지 않는 파일이 210개(약 24MB). `public/site`(마케팅 사이트 HTML이 참조)와 동적으로 조합되는 경로(`plant/apple/...`)가 섞여 있어 이 수치는 **참고용**이다. 삭제는 사용 여부를 화면에서 다시 확인한 뒤에만 한다.

### 4-5. "만들었지만 동작하지 않는" UI
정적 분석으로는 잡히지 않는다. 화면을 실제로 열어 확인해야 한다(설계 단계에서 Playwright로 화면별 점검).

## 5. 구조적 위험 (리팩토링 핵심)

| 파일 | 줄 | useState | useEffect | 비고 |
|---|---|---|---|---|
| `child/ChildScreen.tsx` | 3,498 | 37 | 34 | import 66개, 화면 전체가 한 컴포넌트에 몰림 |
| `parent/RoutineAgentSchedulePanel.tsx` | 2,200 | 10 | 14 | |
| `parent/CalendarSection.tsx` | 1,669 | 22 | 12 | fetch 7곳, 직접 호출 |
| `onboarding/RoutineOnboarding.tsx` | 1,582 | 32 | 2 | |
| `parent/RoutineTab.tsx`, `ApprovalTab.tsx`, `ParentMarketMenuControl.tsx`, `ChildContentZonePopup.tsx` | 1,100~1,400 | | | |

- 상위 4개 파일은 서로 같은 데이터(미션, 일정, 루틴)를 각자 fetch한다. 이 부분은 그래프로 의존관계를 더 봐야 한다.
- 디버깅 이력(`docs/*-2026-10-*`, `triage-*`)에 반복적으로 등장하는 영역: 로그인·자동 로그인 흐름, 미션 보상 처리, 자녀 진입 시 로딩, 위시리스트 스키마 불일치. 이들은 구조 정리 시 같이 정리할 우선순위 후보다.

## 6. 데이터베이스

- 마이그레이션 161개. 같은 번호가 두 번 쓰인 것이 10쌍(`010`, `036`, `037`, `041`, `042`, `043`, `055`, `057`, `060`, `083`). → **확인됨**
- 번호 방식이 3가지로 섞여 있다: `001~126` 순번, `202604~07` 날짜, `202610` 타임스탬프.
- 이미 운영 DB에 적용된 이력이므로 **이름 변경·삭제 금지**가 안전하다. 정리하려면 "현재 스키마 스냅샷" 문서를 따로 만드는 방식이 좋다.
- 운영 DB에는 마이그레이션과 실제 스키마가 어긋난 흔적이 있다(`market_wishlist_items.quantity` 컬럼 누락 오류, 2026-10-25 triage). 스키마 대조는 Supabase에 접근해야 하므로 아직 못 했다.

## 7. 보안 (1차 관찰)

- `.env.example` 존재, `.env*`는 gitignore됨. → 양호
- 서비스 롤 클라이언트(`createServiceRoleClient`)를 쓰는 곳: `parent/home/page.tsx`, `admin/content`, `api/daily-mission/*`, `api/content/*`, `api/public-holidays/sync` 등. RLS를 우회하므로 각 라우트에서 호출자 권한 검증이 필수다. → 아직 검토 전, `/security-audit` 대상
- 2026-10-25~27에 인증 재시도, 보상 쓰기 보호(`protect_reward_writes`) 등 이미 많은 보완이 있었다.

## 8. 이 진단의 한계

- 린트가 동작하지 않아 규칙 위반 수는 모른다.
- 환경변수·DB 접근 없이 진행했다. 빌드 전체, `tests/` 실행, 운영 DB 스키마 대조는 못 했다.
- 미사용 코드는 정적 분석이다. 삭제는 목록 승인 후 화면 확인을 거쳐서만 한다.
- `knip` 같은 외부 분석 도구는 실행이 차단되어 직접 만든 스크립트로 대체했다.
- `graphify` 그래프(`graphify-out/`, 3,918 노드)는 만들어 두었으나 `.claude/skills` 등 도구 파일이 섞여 있고 gitignore했다.

## 9. 사용자와 결정이 필요한 항목 (설계 단계 안건)

1. **운영 상태**: 지금 앱을 실제 사용자(가족)가 쓰고 있는가? 운영 DB 변경 가능 범위가 달라진다.
2. **미사용 21개 파일**: 전부 삭제해도 되는가, 일부는 앞으로 쓸 예정인가? (특히 `MissionSleepMorningLayer`, `ChildOnboardingSurvey`, 위시리스트)
3. **위시리스트·커뮤니티·AI 분석 요약**: 문서에는 있으나 구현이 없거나 중단된 기능. 로드맵에서 뺄지 유지할지.
4. **기준 문서의 위치**: 문서가 현실과 다르면 문서를 고칠지, 코드를 문서에 맞출지. (제안: 현실 코드 기준으로 문서 수정, 미구현 기능은 "로드맵" 섹션으로 이동)
5. **AI 에이전트**: 외부 서비스(`cooanc-agent`)를 계속 쓸지, 저장소로 가져올지, 제거할지.
6. **마케팅 사이트**(`public/site`): 앱과 한 저장소에 계속 둘지. 11월 커밋 대부분이 이쪽이다.
7. **ChildScreen 분해 방식**: 한 번에 큰 변경 vs 화면 영역별로 조금씩. UI 유지가 원칙이므로 화면 캡처 비교를 기준으로 삼는 것을 제안.
8. **린트 복구**: ESLint 설정을 새로 추가할지(규칙 위반이 많이 나올 수 있음).
