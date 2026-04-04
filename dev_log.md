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

## 📑 Commit Message Protocol
1. 모든 커밋 메시지는 이 로그의 최신 기록을 바탕으로 작성한다.
2. **형식**: `type: [작업명] #이슈번호(선택)`
3. **타입 가이드**:
   - `feat`: 새로운 기능 추가
   - `fix`: 버그 수정
   - `docs`: 문서 수정 (`dev_log.md`, `README.md` 등)
   - `refactor`: 코드 구조 개선, 불필요한 파일 삭제
   - `chore`: 패키지 설치, 설정 변경
