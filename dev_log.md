# 📋 Development Log (COOANC)

이 파일은 프로젝트의 모든 변경 사항을 추적하는 블랙박스입니다. 모든 세션 종료 시 아래 템플릿을 사용하여 기록을 남기십시오.

---

## 🚀 Logging Protocol
1. 모든 작업은 세션 단위로 기록한다.
2. `Files Created/Modified`에는 정확한 경로를 기재한다.
3. `Summary`는 핵심 로직 변화 위주로 3문장 이내로 작성한다.

---

## [2026-04-01] - 초기 인프라 구축 세션
- **Status:** ✅ 완료
- **Files Created:**
  - `AI_INSTRUCTIONS.md`
  - `dev_log.md`
  - `tailwind.config.js`
  - `postcss.config.js`
- **Files Modified:**
  - `.gitignore`
  - `package.json`
- **Summary:**
  - 프로젝트 대원칙(AI_INSTRUCTIONS) 및 개발 로그 시스템 수립
  - Tailwind CSS 수동 설정을 통한 UI 프레임워크 활성화
  - 환경 변수 및 보안을 위한 .gitignore 최적화
- **Next Steps:**
  - `src/app/layout.tsx` 및 `globals.css` 기본 설정 적용
  - Supabase 클라이언트 초기화 및 환경 변수 연결

---

## [2026-04-02] - Supabase 클라이언트 라이브러리 구현
- **Status:** ✅ 완료
- **Files Created:**
  - `src/lib/supabase/client.ts`
  - `src/lib/supabase/server.ts`
- **Summary:**
  - Next.js 15 SSR 환경에 대응하는 Supabase 클라이언트 이원화 구성 완료
  - 쿠키 핸들링 및 환경 변수 주입 로직 검증
- **Next Steps:**
  - `src/app/page.tsx`에서 실제 데이터 페칭 테스트
  - Supabase Auth를 활용한 회원가입/로그인 UI 구현

---

## [2026-04-03] - 시스템 통합(Integration) 성공 및 실데이터 렌더링
- **Status:** ✅ MISSION COMPLETE
- **Achievement:**
  - Supabase `children` 테이블 생성 및 `anon` 정책 수립 완료.
  - SQL Editor를 통한 실데이터(김민재, 500crd, 5exp) 주입 성공.
  - `page.tsx`에서 서버 컴포넌트 방식으로 실시간 데이터 페칭 및 JSON 렌더링 확인.
- **Next Steps:**
  - 기획안 UI(대시보드 카드, 캐릭터 영역) 컴포넌트화 시작.
  - Lucide-react 아이콘 및 Tailwind CSS를 활용한 스타일링 적용.

---

## [2026-04-04] - DB 스키마 전체 구축 + 아이 앱 홈 탭 MVP 구현
- **Status:** ✅ 완료
- **Files Created:**
  - `supabase/migrations/001_extensions.sql` — pgvector, uuid-ossp 확장
  - `supabase/migrations/002_profiles.sql` — profiles 테이블 + Auth 트리거
  - `supabase/migrations/003_family_links.sql` — 부모-자녀 연결
  - `supabase/migrations/004_child_stats.sql` — 크레딧/EXP/EQ 3축 컬럼
  - `supabase/migrations/005_missions.sql` — 미션 풀 + Lv.0~5 초기 데이터 34개
  - `supabase/migrations/006_mission_logs.sql` — 미션 수행 로그 + 인덱스
  - `supabase/migrations/007_mission_trigger.sql` — 완료 트리거 (크레딧/하트/EXP/스트릭/레벨업 자동 처리)
  - `supabase/migrations/008_savings_goals.sql` — 저금통 목표
  - `supabase/migrations/009_store_items.sql` — 마켓 상품 + 초기 16개
  - `supabase/migrations/010_purchase_requests.sql` — 구매 요청 + 승인 차감 트리거
  - `supabase/migrations/011_badges.sql` — 뱃지 + 초기 13개
  - `supabase/migrations/012_curriculum_chunks.sql` — RAG 테이블 + search_curriculum() 함수
  - `supabase/migrations/013_eq_function.sql` — recalculate_eq() EQ 3축 계산 함수
  - `supabase/migrations/014_rls.sql` — 전체 RLS 정책 (curriculum_chunks = service_role 전용)
  - `supabase/migrations/015_realtime.sql` — Realtime 3개 테이블 활성화
  - `src/types/database.ts` — 전체 DB 테이블 TypeScript 타입 정의
  - `src/app/(child)/layout.tsx` — 아이 앱 공통 레이아웃 (모바일 컨테이너 + 하단 네비)
  - `src/components/child/ChildNavBar.tsx` — 홈·미션·마켓·스티커 4탭 네비게이션
  - `src/app/(child)/home/page.tsx` — 서버 컴포넌트, child_stats/badges 병렬 조회
  - `src/components/child/HomeTab.tsx` — Realtime 구독, EXP 게이지, 레벨 맵, EQ 지수, 뱃지 UI
  - `src/app/login/page.tsx` — 이메일+비밀번호 로그인 (Supabase Auth)
  - `src/app/signup/page.tsx` — 역할 선택(부모/자녀) + 이름 + 이메일 회원가입
  - `.claude/launch.json` — 개발 서버 실행 설정
- **Files Modified:**
  - `tailwind.config.js` — brand 컬러(blue/green/yellow) + Pretendard 폰트 등록
  - `src/app/globals.css` — Pretendard CDN import + base 레이어
  - `src/app/page.tsx` — 루트(/) → /home 리다이렉트로 교체
  - `supabase/migrations/005_missions.sql` — concept_tag '노동' → '미션' 변경
- **Summary:**
  - COOANC_master_doc.md Part 2 STEP 1 기준 Supabase 마이그레이션 파일 15개 생성 완료. 크레딧 증감은 DB 트리거(007, 010)로만 처리되도록 설계하여 프론트 직접 조작을 구조적으로 차단했다.
  - 아이 앱 홈 탭을 서버(데이터 패칭) + 클라이언트(Realtime 구독) 분리 구조로 구현. child_stats UPDATE 이벤트를 실시간으로 수신해 크레딧·EXP·레벨이 즉각 반영된다.
  - Supabase Auth 기반 로그인·회원가입 페이지 구현. 회원가입 시 raw_user_meta_data에 role/name을 전달하면 handle_new_user() 트리거가 profiles 테이블을 자동 생성한다.
- **Next Steps:**
  - 아이 앱 미션 탭 구현 (오늘의 미션 카드, 정직 확인 카드 팝업, 크레딧 적립 애니메이션)
  - 부모 계정과 자녀 계정을 family_links로 연결하는 온보딩 플로우
  - 로그인 후 role에 따라 아이 앱 / 부모 앱으로 분기하는 라우팅 처리

---

## [2026-04-04 Session 2] - 회원가입 구조 재설계 + 온보딩 + 부모 홈
- **Status:** ✅ 완료
- **Files Created:**
  - `src/app/onboarding/page.tsx` — 자녀 이름·나이·PIN 등록 온보딩 페이지
  - `src/app/api/child/create/route.ts` — 자녀 auth 계정 생성 서버 API (service_role)
  - `src/app/parent/page.tsx` — 부모 홈 (자녀 목록·크레딧·레벨 카드)
  - `supabase/migrations/016_add_age_to_profiles.sql` — profiles.age 컬럼 추가
  - `public/COOANC_Logo.png`, `public/favicon-96x96.png`, `public/apple-touch-icon.png`, `public/web-app-manifest-*.png`, `public/favicon.ico`, `public/favicon.svg`, `public/site.webmanifest` — 로고 및 PWA 아이콘
- **Files Modified:**
  - `src/app/signup/page.tsx` — 역할 선택 제거, 부모 전용 계정 생성 UI
  - `src/app/login/page.tsx` — 로그인 후 role 기반 분기 (부모→/parent or /onboarding, 자녀→/home)
  - `src/app/auth/callback/route.ts` — 이메일 인증 콜백 role 기반 리다이렉트
- **Summary:**
  - COPPA 원칙("부모 주계정 산하 서브 프로필 구조") 준수를 위해 회원가입을 부모 전용으로 재설계. 자녀는 독립 auth 계정이 아닌 부모 온보딩 플로우에서 service_role Admin API로 생성된다.
  - 온보딩(이름·나이·PIN)→API 라우트→auth.users 생성→child_stats+family_links 레코드 생성의 전체 파이프라인 구현 완료.
  - COOANC_Logo.png 및 파비콘/PWA 아이콘 파일을 public/ 디렉터리에 배치하여 로그인·회원가입·온보딩 화면에 실제 로고 이미지 반영.
- **Next Steps:**
  - `SUPABASE_SERVICE_ROLE_KEY` 를 `.env.local`에 추가해야 /api/child/create 동작
  - 아이 앱 미션 탭 구현 (오늘의 미션 카드, 정직 확인 카드 팝업, 크레딧 적립 애니메이션)
  - 부모 홈 대시보드 고도화 (미션 달성률, 최근 활동 로그, AI 한 줄 가이드)

---

## [2026-04-04 Session 3] - 자녀 앱 탭 + 부모 앱 전체 구조 구현
- **Status:** ✅ 완료
- **Files Created:**
  - `src/app/(child)/mission/page.tsx` — 오늘의 미션 서버 컴포넌트 (mission_logs 배정 + 완료 현황 조회)
  - `src/components/child/MissionTab.tsx` — 미션 카드 리스트, 정직 확인 팝업, API 호출
  - `src/app/api/mission/complete/route.ts` — 미션 완료 처리 API (mission_logs is_completed 업데이트)
  - `src/app/(child)/market/page.tsx` — 마켓 서버 컴포넌트 (store_items + 크레딧 조회)
  - `src/components/child/MarketTab.tsx` — 상품 카드, 구매 요청 팝업
  - `src/app/api/market/purchase/route.ts` — 구매 요청 생성 API
  - `src/app/(child)/sticker/page.tsx` — 스티커 서버 컴포넌트 (badges 조회)
  - `src/components/child/StickerTab.tsx` — 뱃지 그리드 (획득/미획득 구분)
  - `src/app/parent/(tabs)/home/page.tsx` — 부모 홈 서버 컴포넌트 (자녀별 통계 병렬 조회)
  - `src/components/parent/HomeTab.tsx` — EQ 지수, 미션 달성률, 최근 활동, AI 가이드
  - `src/app/parent/(tabs)/routine/page.tsx` — 루틴 서버 컴포넌트 (전체 미션 조회)
  - `src/components/parent/RoutineTab.tsx` — 자녀별 미션 현황 + 레벨별 필터링
  - `src/app/parent/(tabs)/approval/page.tsx` — 승인 서버 컴포넌트 (pending 구매 요청 조회)
  - `src/components/parent/ApprovalTab.tsx` — 요청 카드, 승인/거절 API 호출
  - `src/app/api/parent/purchase/[id]/route.ts` — 구매 요청 승인/거절 API
  - `src/store/parentStore.ts` — Zustand 자녀 선택 상태 (selectedChildId)
  - `src/components/parent/ChildSwitcher.tsx` — 자녀 전환 탭 (1명이면 숨김)
- **Files Modified:**
  - `src/app/parent/layout.tsx` — 부모 앱 레이아웃 (홈→루틴→승인 탭 순서)
  - `src/app/parent/(tabs)/home/page.tsx` — `profiles.age` 컬럼 제거로 조회 오류 수정
  - `src/app/login/page.tsx` — 로그인 후 role 기반 분기
- **Summary:**
  - 자녀 앱 4개 탭(홈/미션/마켓/스티커) 및 부모 앱 3개 탭(홈/루틴/승인) 전체 구현 완료.
  - 부모 앱을 Zustand(parentStore)로 selectedChildId 전역 공유하여 홈·루틴 탭 간 자녀 선택 상태 동기화.
  - `profiles.age` 컬럼 미존재로 자녀 목록이 빈 배열로 반환되던 버그 수정 (select 쿼리에서 age 필드 제거).
- **Next Steps:**
  - 디바이스 모드 시스템 구현 (setup/settings + DeviceModeRouter)

---

## [2026-04-05] - 디바이스 모드 설정 및 자동 분기 시스템 구현
- **Status:** ✅ 완료
- **Files Created:**
  - `src/store/deviceStore.ts` — Zustand deviceMode + pin 스토어 (localStorage 동기화)
  - `src/app/setup/page.tsx` — 2단계 모드 설정 화면 (모드 선택 카드 → PIN 4자리 숫자 키패드)
  - `src/app/settings/page.tsx` — 앱 설정 페이지 (PIN 인증 후 모드 변경, 프로필 이름 편집, 알림/소리 토글, 로그아웃)
  - `src/middleware.ts` — Supabase 세션 쿠키 자동 갱신 미들웨어
- **Files Modified:**
  - `src/app/page.tsx` — 서버 redirect 제거 → 클라이언트 DeviceModeRouter로 교체 (localStorage → Supabase session → role 기반 분기)
  - `src/app/login/page.tsx` — 로그인 후 `/`로 라우팅 (DeviceModeRouter에 분기 위임)
  - `src/components/parent/HomeTab.tsx` — 헤더에 ⚙️ 설정 아이콘 (→ /settings) 추가
  - `src/components/child/ChildNavBar.tsx` — 하단 네비에 설정(⚙️) 탭 추가
- **Summary:**
  - `cooanc_device_mode`(shared/child/parent)를 localStorage에 저장하고, 루트(/) 접근 시 클라이언트에서 모드 + Supabase 세션을 읽어 적절한 화면으로 자동 분기하는 DeviceModeRouter 구현.
  - 첫 실행 시 /setup으로 이동하여 3가지 모드 카드 선택 + PIN 4자리 입력(확인 포함)으로 설정을 완료하고, /settings에서 PIN 인증 후 모드 변경 가능.
  - 미들웨어는 localStorage 접근 불가(서버 사이드)이므로 Supabase 쿠키 세션 갱신만 담당하고, 라우팅 분기 전체는 클라이언트 컴포넌트에서 처리하는 구조.
- **Next Steps:**
  - /setup 및 /settings 페이지에 대한 (child) 레이아웃 예외 처리 확인
  - 자녀 앱 홈 탭 AI 코칭 가이드 실제 AI 연동
  - 부모 앱 실시간 알림 (Supabase Realtime) 연동

---

## [2026-04-06] - 마켓 3×3 선반 UI·데일리 미션·루틴·스티커·DB 대량 반영
- **Status:** ✅ 완료
- **Git 범위 (참고):** `8dc03a6^..a72f7f5` (당일 커밋 다수, 메시지에 로그인/회원가입 개선·마켓 선반 리디자인·선반 클리핑/팝업 수정 등)
- **Files Created (대표):**
  - `src/components/child/ChildHomeIslandStage.tsx`, `ChildHomeSceneryBand.tsx`, `ChildSceneryTopPills.tsx` — 홈 섬·상단 풍경 UI 골격
  - `src/components/child/BearStickerSheet.tsx`, `BearBoardCompleteModal.tsx`, `src/lib/bearBoardLayout.ts` — 곰 스티커판·완주 모달
  - `src/components/parent/EconomicEqPanel.tsx`, `src/lib/childEqAiPlaceholders.ts` — 경제 EQ 패널·AI 플레이스홀더
  - `src/components/parent/ParentMarketMenuControl.tsx`, `RoutineAlarmSettingsSheet.tsx`, `RoutineKeywordBuilderSheet.tsx`, `SpecialMissionAddSheet.tsx`, `SpecialMissionBonusSheet.tsx` — 부모 루틴·마켓·특별 미션 UI
  - `src/app/api/daily-mission/assign-today/route.ts`, `src/app/api/feedback/mission-suggest/route.ts`, `src/app/api/market/child-hidden-item/route.ts`, `src/app/api/market/parent-store-item/route.ts`, `src/app/api/parent/enter-child-ui/route.ts`, `src/app/api/praise-sticker/grant/route.ts` 등 API 라우트
  - `supabase/migrations/022_`~`038_*.sql` 일대 — 미션 RLS·데일리 미션·보상 배수·숨김 마켓·스토리지·칭찬 스티커·슬롯·그랜트 등
  - `public/assets/img/layouts/backgrounds/kids_background*.png`, `market_roof.png`, 알림/카운트다운 오디오 등 에셋
- **Files Modified (대표):**
  - `src/components/child/MarketTab.tsx` — **3×3 선반** 기반 마켓 화면 리디자인
  - `src/components/child/MissionTab.tsx`, `src/app/(child)/mission/page.tsx`, `src/app/api/daily-mission/complete/route.ts` — 데일리 미션·완료 흐름 확장
  - `src/components/parent/RoutineTab.tsx`, `CalendarSection.tsx`, `onboarding/RoutineOnboarding.tsx` — 루틴·캘린더·온보딩 대규모 수정
  - `src/components/parent/ApprovalTab.tsx`, `src/app/parent/(tabs)/**` — 승인·홈·루틴 페이지 연동
  - `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/settings/page.tsx` — 로그인/회원가입·설정 UX·에러 처리 보강
  - `next.config.mjs`, `package.json` — 설정·의존성 소폭
- **Summary:**
  - 자녀 마켓을 **3×3 선반** UI로 바꾸고 선반 클리핑·구매 팝업 위치를 다듬었으며, 로그인/회원가입 쪽은 에러 처리와 UI를 반복 개선한 커밋이 이어졌습니다.
  - 데일리 미션 배정/완료, 부모 루틴(알람·키워드·특별 미션)·캘린더·온보딩, 칭찬 스티커·곰 스티커판, 자녀 홈 **섬·배경** 등 화면·API가 한꺼번에 들어왔고 Supabase 마이그레이션도 `022`~`038` 구간으로 크게 늘었습니다.
  - 부모 자녀 UI 진입(`enter-child-ui`)·숨김 마켓·스토어 이미지 스토리지 등 백엔드·RLS를 미션·마켓 도메인에 맞춰 정렬했습니다.
- **Next Steps:**
  - 마켓·미션·루틴 통합 QA (기기별 레이아웃·권한)
  - 마이그레이션 원격 적용 순서·롤백 계획 점검

---

## [2026-04-07] - 홈·미션 스케일 조정 + 마켓 보상·위시리스트·지갑·저금통 크레딧
- **Status:** ✅ 완료
- **Git 범위 (참고):** `a72f7f5..6aa5393` (`fix scale of home and mission tab`, `fix scales`, `revamp child market rewards and wishlist flow` 등)
- **Files Created (대표):**
  - `src/app/api/child/credits/transfer/route.ts` — 크레딧 이동(지갑↔저금통 등)
  - `src/app/api/market/wishlist/route.ts`, `src/app/api/market/complete-delivery/route.ts` — 위시리스트·배송 완료
  - `src/components/child/MarketPurchaseConfirmDialog.tsx`, `MarketPurchaseSuccessOverlay.tsx`, `MarketRequestsBottomSheet.tsx`, `MarketWishlistBottomSheet.tsx` — 구매 확인·성공·요청·위시리스트 시트
  - `src/components/child/MissionCreditMoveDialog.tsx`, `MissionCreditToPiggyOverlay.tsx`, `MissionSleepMorningLayer.tsx` — 미션 탭 크레딧 이동·저금통·수면/아침 레이어
  - `src/components/child/FloatingCreditsStackVisual.tsx`, `PiggyBankStageVisual.tsx`, `TodayWeatherBadge.tsx` — 크레딧 시각화·저금통 단계·날씨 뱃지
  - `src/lib/childCreditsSplit.ts`, `marketItemFrame.ts`, `missionRoutineIconFrame.ts`, `constants/missionRoutineAtlas.ts`, `constants/piggyBankStages.ts` — 크레딧 분할·프레임·아틀라스
  - `src/app/api/praise-sticker/place/route.ts`, `reset-board/route.ts` — 스티커 배치·보드 리셋 API
  - `supabase/migrations/036_`~`041_*.sql` — 숨김 마켓 RPC·구매 요청·지갑/저금통/위시리스트·수량
  - `public/assets/img/items/rewards/credits.*`, 스티커·컨페티·UI(바구니·지도 등) 에셋
- **Files Modified (대표):**
  - `src/components/child/MarketTab.tsx`, `src/app/(child)/market/page.tsx`, `src/app/api/market/approve/route.ts`, `request/route.ts` — 자녀 마켓 보상·승인·요청 플로우 전면 개편
  - `src/components/child/ChildHomeIslandStage.tsx`, `HomeTab.tsx`, `MissionTab.tsx` — **홈·미션 탭 스케일/레이아웃** 조정
  - `src/components/parent/ApprovalTab.tsx`, `ParentNewPurchaseRequestModal.tsx` — 부모 승인·신규 구매 요청 모달
  - `src/app/globals.css`, `tailwind.config.js` — 스타일·토큰 확장
- **Summary:**
  - 홈·미션 탭의 **표시 스케일**을 맞추는 수정이 먼저 이어졌고, 이어 자녀 마켓을 **보상·위시리스트·구매 확인/성공** 흐름 중심으로 크게 갈아엎었습니다.
  - 지갑·저금통·위시리스트를 DB·API(`040`~`041` 등)와 맞추고, 미션 탭에서 크레딧 이동 다이얼로그·저금통 오버레이·동전 시각화 컴포넌트를 추가했습니다.
  - 칭찬 스티커 **배치·보드 리셋** API와 루틴 아이콘 아틀라스·에셋이 보강되었습니다.
- **Next Steps:**
  - 크레딧 이전·위시리스트·승인 시나리오 E2E 테스트
  - 4/8 이후 UI(미션 섬 미세 조정·`042` EQ 트리거)와 함께 통합 검증

---

## [2026-04-08] - 미션 섬 크레딧 UI·연출 + 저금통 자산·EQ 보강
- **Status:** ✅ 완료
- **Files Created:**
  - `public/assets/img/items/piggy-bank/piggy_bank.png`, `piggy_bank.json` — 저금통 스프라이트(구 gold_piggy 대체)
  - `src/constants/piggy_bank.atlas.json` — TexturePacker 아틀라스 메타
  - `supabase/migrations/042_eq_recalculate_wallet_piggy_triggers.sql` — 지갑·저금통 변동 시 EQ 재계산 트리거
- **Files Modified (요약):**
  - `src/components/child/ChildHomeIslandStage.tsx` — 가운데·저금통·지갑 배치, 가용 크레딧 숫자 여백/색(`text-sky-900`), 지갑 아이콘만 `-translate-y` 등
  - `src/components/child/FloatingCreditsStackVisual.tsx` — 동전~럭셔리 단계 연출: 표시 크레딧 스텝 애니메이션, `visualKey` 안정화+width 전환, 왕관·다이아·금괴 오프셋
  - `src/components/child/MissionCreditMoveDialog.tsx`, `MarketTab.tsx` — 크레딧 숫자 색·마켓 가격 표시 통일
  - `src/components/child/PiggyBankStageVisual.tsx`, `src/constants/piggyBankStages.ts` — 새 저금통 스테이지·비율 스케일
  - `src/app/api/praise-sticker/place/route.ts`, `reset-board/route.ts` — `resolveApiActorChildId` 판별 시 `resolved.ok === false`로 타입 좁힘
  - `src/lib/childCreditsSplit.ts` — `mergeChildStatsPatch` 첫 분기 `ChildStats` 단언
  - `src/types/database.ts`, `supabase/migrations/013_eq_function.sql`, `src/components/parent/EconomicEqPanel.tsx`, `src/lib/childEqAiPlaceholders.ts` — EQ/타입·문구 정리
  - `src/app/(child)/layout.tsx`, `src/components/child/MissionTab.tsx`, `ChildHomeSceneryBand.tsx`, `src/components/parent/HomeTab.tsx` — 레이아웃·탭 관련 조정
  - `src/components/common/SpriteImage.tsx` — 소소한 보정
- **Files Deleted:**
  - `public/assets/img/items/piggy-bank/gold_piggy_bank.*` — 구 황금돼지 자산
  - `public/assets/img/layouts/backgrounds/market_shelf.png`, `market_shelf_.png` — 미사용 배경 제거
- **Summary:**
  - 미션 섬에서 가용 크레딧·저금통·지갑의 위치·간격·색을 정리하고, 동전 더미가 금액에 따라 단계적으로 커지도록 표시값 보간·스프라이트 전환을 넣었습니다.
  - 저금통은 새 `piggy_bank` 스프라이트·스테이지 규칙으로 통일했고, EQ는 지갑/저금통 변동 시 재계산되도록 마이그레이션을 추가했습니다.
  - 빌드 깨짐을 막기 위해 praise-sticker API와 `childCreditsSplit`의 TypeScript 판별을 수정했습니다.
- **Next Steps:**
  - Supabase에 `042` 마이그레이션 적용 후 트리거·EQ 동작 검증
  - 미션 섬 레이아웃은 기기별 스크린샷으로 한 번 더 확인

---

## [2026-04-09] - 미션 섬 크레딧·저금통 UI 다듬기 + 옮기기 다이얼로그·에셋
- **Status:** ✅ 완료
- **Git:** `385d989` — `feat(child): 미션 섬 크레딧·저금통 UI 정리 및 관련 개선` (`main` push)
- **Files Created (에셋·맵):**
  - `public/assets/img/games/map/bank.png`, `bank2.png`, `home.png`, `map.png`, `market.png`, `market2.png`
  - `public/assets/img/layouts/backgrounds/background2.png` ~ `background4.png`, `grass_background.png`
- **Files Modified (핵심):**
  - `src/components/child/ChildHomeIslandStage.tsx` — 돼지·크레딧·지갑 `drop-shadow`(번짐·오프셋 0), 맵 배경 `blur` 완화, 돼지/지갑/가용 크레딧 `translate-y` 분리·저금통 추가 하강, 크레딧 **숫자를 열마다** 아이콘·건물 바로 위로 배치
  - `src/components/child/FloatingCreditsStackVisual.tsx` — 동전 7단계·프레임별 실제 비율로 레이아웃 높이·너비 계산, `filter`를 바깥 래퍼로 분리·가로 잘림 완화, `width/height` CSS 트랜지션 제거; (이전 맥락) 단계별 크기·다이아/왕관 제거·500티어 `credit10` 등
  - `src/components/child/PiggyBankStageVisual.tsx` — 초기 단계 광학 배율·`filter` 래퍼·여백으로 엉덩이·그림자 잘림 완화
  - `src/components/child/MissionCreditMoveDialog.tsx`, `MissionTab.tsx` — `float_to_piggy` 미리보기를 `PiggyBankStageVisual`+`piggyBankStepIndexForBalance`로 교체, `piggyBalance` prop, 수량 입력 **초기값 0**
  - `src/constants/piggyBankStages.ts` — (필요 시) 미션 단계 상한 등 상수 정리
- **Files Modified (동반 커밋):**
  - `ChildTopBar.tsx`, `HomeTab.tsx`, `MarketTab.tsx`, `MarketPurchaseConfirmDialog.tsx`, `MissionSleepMorningLayer.tsx`, `ApprovalTab.tsx`, `ParentMarketMenuControl.tsx`, `PraiseStickerPanel.tsx`, `RoutineTab.tsx`, `src/lib/praiseAssetStickers.ts`, `public/.../background.png` 등
- **Summary:**
  - 미션 섬에서 아이콘 그림자·맵 흐림·저금통·지갑 위치를 조정하고, 가용 크레딧 스프라이트가 단계별로 잘리지 않도록 박스·그림자 구조를 바꿨으며, 크레딧 숫자를 건물·아이콘에 가깝게 열 단위로 붙였습니다.
  - 옮기기 팝업은 깨지던 저금통 스프라이트를 현재 잔액 단계 이미지로 보이게 하고 입력은 0부터 시작하도록 맞췄습니다.
  - 맵·배경 PNG와 부모/마켓/칭찬 등 로컬 수정을 동일 커밋에 포함해 원격 `main`에 반영했습니다.
- **Next Steps:**
  - 실제 기기에서 미션 섬·옮기기 팝업 스크린샷으로 잘림·겹침 재확인
  - `MissionTab.tsx` 등 에디터에서 “1줄”로 보일 때 디스크 내용과 불일치 여부 확인(저장·인코딩)

---

## [2026-04-09] - 온보딩 캐릭터 선택·설정 자녀 카드·뒤로가기 (UI 세션)
- **Status:** ✅ 완료
- **Git:** `feat(parent): 온보딩 캐릭터 블록·설정 자녀 카드·뒤로가기 문구` — `main` push (해시는 `git log -1 --oneline`)
- **Files Modified:**
  - `src/components/common/ChildProfileAvatarPicker.tsx` — 온보딩: 캐릭터 썸네일 축소, 원형 링 제거 후 카드 내 사각 블록(`rounded-lg`) + `object-contain`으로 전신이 보이게
  - `src/components/parent/CompactChildProfileCard.tsx` — `hideStats`·`actions` props: 오른쪽 통계 그리드 대신 슬롯(설정의 수정/삭제 등)
  - `src/app/settings/page.tsx` — 자녀 프로필을 홈과 동일 카드 레이아웃으로 표시(`child_stats.current_level` 조회), 크레딧·하트·스트릭 숨김; 상단 `<` 제거 → 작은 회색 「이전으로 돌아가기」텍스트 버튼(`router.back`)
- **Summary:**
  - 자녀 등록 온보딩에서 캐릭터 선택 UI를 사각 프레임 안에 넣고 크기를 줄여 카드와 균형을 맞췄습니다.
  - 설정 탭 자녀 줄을 `CompactChildProfileCard`로 통일하고 오른쪽은 수정·삭제만 두었습니다.
  - 설정 헤더 뒤로가기는 꺾쇠 아이콘 대신 얇은 회색 문구 링크로 바꿨습니다.
- **Next Steps:**
  - 다자녀 설정 화면에서 카드 여러 개 스크롤·삭제 확인 레이아웃을 실제 폭에서 한 번 확인

---

## 📑 Commit Message Protocol
1. 모든 커밋 메시지는 이 로그의 최신 기록을 바탕으로 작성한다.
2. **형식**: `type: [작업명] #이슈번호(선택)`
3. **타입 가이드**:
   - `feat`: 새로운 기능 추가
   - `fix`: 버그 수정
   - `docs`: 문서 수정 (`dev_log.md`, `README.md` 등)
   - `refactor`: 코드 구조 개선, 불필요한 파일 삭제
   - `chore`: 패키지 설치, 설정 변경
