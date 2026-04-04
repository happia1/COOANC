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

## 📑 Commit Message Protocol
1. 모든 커밋 메시지는 이 로그의 최신 기록을 바탕으로 작성한다.
2. **형식**: `type: [작업명] #이슈번호(선택)`
3. **타입 가이드**:
   - `feat`: 새로운 기능 추가
   - `fix`: 버그 수정
   - `docs`: 문서 수정 (`dev_log.md`, `README.md` 등)
   - `refactor`: 코드 구조 개선, 불필요한 파일 삭제
   - `chore`: 패키지 설치, 설정 변경
