# COOANC (쿠앵크) — 프로젝트 문서 인덱스

> Claude Code 작업 시 이 파일을 먼저 읽고, 필요한 문서를 선택적으로 참조하세요.
> 모든 문서는 `docs/` 폴더 하위에 위치합니다.

---

## 프로젝트 한 줄 요약

**COOANC(쿠앵크)** 는 4~11세 자녀의 건강한 습관 형성을 게이미피케이션으로 돕는 **모듈형 습관 플랫폼**입니다. 경제 습관을 첫 번째 모듈로 시작하며, 동일한 엔진 위에 생활/독서/건강/학습/취미 카테고리를 순차적으로 확장합니다.

---

## 현재 개발 상태

```
✅ Supabase 프로젝트 생성 + Auth 설정
✅ Next.js 연동 (.env.local 세팅)
✅ 아이/부모 모드 분리 구조 (단일 Next.js 앱)
✅ UI 디자인 시안 완성
⬜ 실제 서비스 테이블 미생성 (connection_test만 존재)
⬜ 에셋 (캐릭터/아이콘) 작업 중
```

---

## 현재 Phase

**Phase 1 MVP** — AI 없이 완전히 작동하는 구조 먼저 구현

```
포함:
✓ 미션 → 크레딧/EXP 적립 (부모 수동 설정)
✓ 마켓 구매 요청 + 부모 승인 플로우
✓ 레벨 0~2 (행동→보상→교환 개념)
✓ 기본 뱃지 시스템
✓ 부모 앱 경제 EQ 기본 대시보드
✓ 정직 확인 카드, 칭찬 스티커, 딜리버리 화면

제외 (Phase 2 이후):
✗ AI 미션 자동 추천 에이전트 (LangGraph + RAG)
✗ 레벨 3~5 (저축, 나눔, 투자)
✗ 랭킹 시스템
✗ 소셜 기능 (크레딧 선물/교환)
```

---

## 문서 목록

### 📋 제품 (product/)

| 파일 | 내용 | 참조 타이밍 |
|------|------|-------------|
| `product/PRD.md` | 제품 비전, 기능 요구사항, 사용자 시나리오, 기술 요구사항, 수익 모델 전체 | 기능 구현 전 전체 파악 시 |
| `product/IA.md` | 부모/자녀 앱 정보 구조, 탭별 구성 요소, 사용자 흐름 상세 | 화면 구조 구현 시 |

### 🎨 디자인 (design/)

| 파일 | 내용 | 참조 타이밍 |
|------|------|-------------|
| `design/design_guide.md` | 컬러 팔레트, 타이포그래피, 컴포넌트 가이드, 애니메이션 원칙 | UI 컴포넌트 구현 시 |
| `design/diagrams/KIDS_FLOW.png` | 자녀 앱 사용자 흐름 다이어그램 | 아이 앱 플로우 구현 시 |
| `design/diagrams/PARENT_FLOW.png` | 부모 앱 사용자 흐름 다이어그램 | 부모 앱 플로우 구현 시 |
| `design/diagrams/SYSTEM_ARCH.png` | 4-Layer 시스템 아키텍처 다이어그램 | 전체 구조 파악 시 |

### ⚙️ 엔지니어링 (engineering/)

| 파일 | 내용 | 참조 타이밍 |
|------|------|-------------|
| `engineering/COOANC_master_doc.md` | DB 스키마 전체 (SQL), 트리거, RLS, RAG Knowledge Base, 개발 가드레일, 성장 로드맵 | DB 작업 및 에이전트 구현 시 |

---

## 앱 구조 요약

```
단일 Next.js 앱 (아이/부모 모드 분리)
├── 아이 앱 (Kids UI)
│   ├── 홈 탭 — 내 캐릭터(쿠앵이) & 꾸미기, 레벨/뱃지 현황
│   ├── 미션 탭 — 오늘의 미션, 정직 확인 카드, 크레딧 적립 애니메이션
│   ├── 마켓 탭 — 상품 구매 요청, 자물쇠/활성화 시각화, 딜리버리 화면
│   └── 스티커 탭 — 곰돌이 스티커 판, 드래그앤드롭
│
└── 부모 앱 (Parent UI)
    ├── 홈 탭 — 자녀 활동 모니터링, 경제 EQ 지수, AI 행동 분석
    ├── 루틴 매니저 탭 — AI 챗봇 기반 루틴 설정 (Phase 2), 미션 카드 관리
    └── 승인 & 큐레이션 탭 — 구매 요청 승인/반려, 미션 롤백, 큐레이션 커머스
```

---

## 기술 스택

```
프론트엔드:  Next.js 15 (App Router) + TypeScript + Tailwind CSS
DB:          Supabase (PostgreSQL + pgvector)
인증:        Supabase Auth
실시간:      Supabase Realtime (mission_logs, purchase_requests, child_stats)
AI (Phase 2): LangGraph + OpenAI GPT-4o + RAG (pgvector)
배포:        Vercel (Hobby)
에셋 경로:   public/src/img (3D 그래픽), public/src/audio (효과음)
```

---

## 핵심 설계 원칙 (개발 가드레일)

```
1. 크레딧 증감 → 반드시 DB 트리거로만 처리 (프론트 직접 조작 금지)
2. curriculum_chunks 테이블 → service_role만 접근 (RLS 적용)
3. EQ 지수 계산 → recalculate_eq() 함수 경유 필수
4. Realtime 구독 → mission_logs / purchase_requests / child_stats 3개만
5. 에셋 없는 부분 → icon_emoji 필드 활용 또는 플레이스홀더로 임시 처리
```

---

## 캐릭터 & 브랜드

- **서비스명**: COOANC (쿠앵크)
- **메인 캐릭터**: 쿠앵이
- **슬로건**: 자녀 경제 성장의 닻을 내리다
- **타겟**: 4~11세 자녀를 둔 부모 (워킹맘/대디)
- **디자인 스타일**: 3D 그래픽, Pretendard (부모) / 둥근 고딕체 (자녀)
- **메인 컬러**: #4A90E2 (블루) / #7ED321 (그린) / #F8E71C (옐로우)

---

## Claude Code 작업 시작 예시

```
# DB 세팅
@docs/engineering/COOANC_master_doc.md 의 STEP 1 SQL을
supabase/migrations/ 에 순서대로 마이그레이션 파일로 만들어줘

# 아이 앱 홈 화면 구현
@docs/product/IA.md 와 @docs/design/design_guide.md 참고해서
아이 앱 홈 탭 (캐릭터 + 크레딧 현황) 구현해줘
에셋은 아직 없으니 이모지 플레이스홀더로 처리해줘

# 미션 완료 플로우 구현
@docs/product/PRD.md 의 2.1 섹션과
@docs/design/diagrams/KIDS_FLOW.png 참고해서
미션 완료 → 정직 확인 카드 → 크레딧 적립 애니메이션 플로우 구현해줘
```
