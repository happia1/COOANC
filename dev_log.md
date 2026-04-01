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

## [2026-04-03] - page.tsx Postgres(PostgREST) 연결 검증
- **Status:** ✅ 완료
- **Files Modified:**
  - `src/app/page.tsx`
  - `dev_log.md`
- **Summary:**
  - 서버 컴포넌트에서 `from().select()`로 PostgREST 경유 Postgres 조회를 수행해 DB 연결을 검증함
  - 테이블 미생성·RLS 차단 시 대시보드 SQL Editor용 `connection_test` 스크립트를 화면에 노출
- **Next Steps:**
  - 운영 전 `connection_test` 정책 정리 또는 제거, 실제 도메인 테이블·RLS 설계
  - Supabase Auth 기반 회원가입/로그인 UI

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
