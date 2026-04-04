# COOANC 마스터 문서
> **전달일**: 2026-04-04
> **작성자**: 강수민 (RHYMIA 대표)
> **문서 구성**:
> - Part 0. 제품 비전 & 성장 로드맵 — 투자자/심사위원용 전략 문서 (신규)
> - Part 1. RAG Knowledge Base — AI 에이전트 지식베이스 (커리큘럼 전체)
> - Part 2. DB 스키마 + 구현 명세 — Supabase 기준 전체 스키마, 트리거, RLS, RAG

---

## 마누스 반영 요청 사항

아래 내용을 기존 PRD, IA, 데이터 스키마, 개발 가드레일 문서에 반영해주세요.

1. **PRD 앞단** — Part 0 전체를 제품 비전 섹션으로 추가
2. **PRD 본문** — 커리큘럼 기반 AI 에이전트 기능(미션 자동 추천, 승급 자동 판단, 코칭 메시지)을 핵심 기능으로 추가
3. **IA** — 아이 앱/부모 앱의 레벨 맵, 저금통, 뱃지, 랭킹 화면 구조 반영
4. **데이터 스키마** — Part 2의 STEP 1 전체를 기존 스키마에 병합. 보안 관련 항목(RLS 정책, 트리거 기반 크레딧 처리, service_role 전용 curriculum_chunks) 명시
5. **개발 가드레일** — 아래 4가지 규칙 추가:
   - 크레딧 증감은 반드시 DB 트리거로만 처리 (프론트 직접 조작 금지)
   - curriculum_chunks 테이블은 service_role만 접근 가능
   - EQ 지수 계산은 `recalculate_eq()` 함수 경유 필수
   - Realtime 구독은 mission_logs, purchase_requests, child_stats 3개 테이블만

---

# Part 0. 제품 비전 & 성장 로드맵

---

## 1. 제품 비전 & 포지셔닝

COOANC는 아이의 라이프사이클에 맞는 건강한 습관을 게이미피케이션으로 형성하는 **모듈형 습관 플랫폼**입니다.

경제 습관을 첫 번째 콘텐츠 모듈로 시작하며, 동일한 게이미피케이션 엔진 위에 생활/독서/건강/학습/취미 등 자녀 성장에 필요한 습관 카테고리를 순차적으로 확장합니다.

> 핵심 포지셔닝: "경제 교육 앱"이 아닌 **"자녀 습관 형성 플랫폼"**
> 경제 습관은 플랫폼의 첫 번째 킬러 콘텐츠입니다.

---

## 2. 단계별 제품 로드맵

| 단계 | 시기 | 핵심 목표 | 제품 범위 | 수익 구조 |
|------|------|-----------|-----------|-----------|
| Phase 0 | 완료 | 핵심 엔진 검증 | 생활습관 루틴 프로토타입 | 없음 |
| Phase 1 | 현재 | MVP 출시 + 유저 확보 | 경제습관 모듈, AI 없이 구현 | 없음 |
| Phase 2 | MAU 1,000+ | AI 개인화 + 수익화 시작 | RAG 에이전트, 프리미엄 구독 | 구독 |
| Phase 3 | MAU 10,000+ | 플랫폼 확장 | 독서/건강/학습 모듈, B2B | 구독 + B2B |
| Phase 4 | MAU 50,000+ | 슈퍼앱 완성 | 취미/여가 모듈, 기관 연계 | 구독 + B2B + B2G |

---

## 3. 모듈 확장 구조

### 공통 엔진 (한 번만 만들면 됨)
```
공통 인프라
├── 크레딧 시스템
├── 게이미피케이션 (레벨 / 뱃지 / 랭킹)
├── 부모-자녀 연결 (승인 / 알림 / 리포트)
└── AI 추천 엔진 (Phase 2~, RAG 기반)
```

### 습관 카테고리 모듈 (콘텐츠만 얹는 구조)
```
├── ✅ 생활습관 — 루틴, 자립, 기본 예절        (Phase 0, 완료)
├── 🔨 경제습관 — 저축, 소비, 교환, 투자        (Phase 1, 현재)
├── 📚 독서습관 — 읽기, 독후감, 어휘            (Phase 3)
├── 🏃 건강습관 — 운동, 수면, 식습관            (Phase 3)
├── 📖 학습습관 — 공부, 숙제, 집중력            (Phase 3~)
└── 🎨 취미/여가 — 악기, 미술, 스포츠           (Phase 4~)
```

모든 카테고리는 동일한 게이미피케이션 엔진 위에서 작동합니다. 새로운 습관 카테고리 추가 시 엔진 재개발 없이 콘텐츠 모듈만 얹는 구조로, 확장 비용과 개발 기간이 획기적으로 단축됩니다. 아이가 성장하면서 필요한 습관이 달라지는 라이프사이클에 맞춰 플랫폼이 함께 성장합니다.

---

## 4. 왜 슈퍼앱 구조인가

**단일 앱 안에 모듈을 쌓는 이유:**

- **유저 락인**: 아이가 성장하는 10년 동안 자연 유지. 일반 앱과 달리 라이프사이클 기반 장기 락인
- **데이터 통합**: 모든 습관 카테고리 데이터가 하나의 경제 EQ 지수로 통합 — 타 서비스 대비 압도적 데이터 자산
- **확장 비용 최소화**: 공통 엔진 재사용, 모듈만 추가하는 구조로 신규 카테고리 출시 비용 최소화
- **네트워크 효과**: 친구 간 크레딧 선물/랭킹 경쟁 → 자녀 → 부모 → 지인으로 자연 바이럴

**별도 앱으로 쪼개지 않는 이유:**
- 앱을 여러 개 설치해야 하는 순간 이탈률 급등
- 크레딧/프로필/게이미피케이션 분산 시 락인 효과 소멸
- 투자자 관점에서 멀티앱 운영 = 리소스 분산으로 인식

---

## 5. Phase 1 MVP 범위 (개발 스코프 명확화)

Phase 1은 AI 없이도 완전히 작동하는 구조로 먼저 만들고, 유저 데이터가 쌓인 후 AI를 붙이는 전략입니다.

**포함 (Phase 1):**
- 미션 → 크레딧 적립 (부모 수동 설정)
- 마켓 구매 요청 + 부모 승인 플로우
- 레벨 0~2 (행동→보상→교환 개념)
- 기본 뱃지 시스템
- 부모 앱 경제 EQ 기본 대시보드

**제외 → Phase 2 이후:**
- AI 미션 자동 추천 에이전트
- RAG Knowledge Base 임베딩
- 레벨 3~5 (저축, 나눔, 투자)
- 랭킹 시스템 (유저 충분할 때)
- 실물 교환 배송 트래커 고도화

**운영 비용 전략:**
- Supabase Free tier + Vercel Hobby → 초기 운영비 최소화
- AI 붙이기 전까지 추가 인프라 비용 없음

---

아래 내용을 기존 PRD, IA, 데이터 스키마, 개발 가드레일 문서에 반영해주세요.

1. **PRD** — 커리큘럼 기반 AI 에이전트 기능(미션 자동 추천, 승급 자동 판단, 코칭 메시지)을 핵심 기능으로 추가
2. **IA** — 아이 앱/부모 앱의 레벨 맵, 저금통, 뱃지, 랭킹 화면 구조 반영
3. **데이터 스키마** — Part 2의 STEP 1 전체를 기존 스키마에 병합. 보안 관련 항목(RLS 정책, 트리거 기반 크레딧 처리, service_role 전용 curriculum_chunks) 명시
4. **개발 가드레일** — 아래 4가지 규칙 추가:
   - 크레딧 증감은 반드시 DB 트리거로만 처리 (프론트 직접 조작 금지)
   - curriculum_chunks 테이블은 service_role만 접근 가능
   - EQ 지수 계산은 `recalculate_eq()` 함수 경유 필수
   - Realtime 구독은 mission_logs, purchase_requests, child_stats 3개 테이블만

---

# Part 1. RAG Knowledge Base

> **문서 목적**: COOANC 앱의 AI 에이전트가 RAG(Retrieval-Augmented Generation)로 검색하여 활용하는 지식 베이스
> **청킹 전략**: 각 섹션(##)이 독립 청크 단위. 메타데이터 블록이 모든 청크 상단에 포함
> **업데이트 정책**: 레벨 추가/미션 변경 시 해당 청크만 교체

---

## [META-001] 시스템 개요 및 설계 원칙

```
chunk_id: META-001
chunk_type: system_overview
tags: [overview, design_principle, level_system]
retrieval_trigger: [시스템 설명, 레벨 구조, 설계 원칙, 전체 흐름]
```

### COOANC란
COOANC는 아이의 경제 개념 발달 단계에 맞춰 미션과 보상을 자동으로 제공하는 AI 기반 경제 교육 앱입니다.

### 핵심 설계 원칙
- **레벨 = 연령이 아닌 개념 숙달도**: 같은 나이여도 개인차가 있으므로, 연령이 아닌 행동 데이터 기반으로 레벨을 판단합니다.
- **경험 기반 학습**: 부모의 설명보다 아이의 직접 경험(미션 수행, 구매, 저축)을 통해 경제 개념을 체득합니다.
- **이중 보상 구조**: 크레딧(경제적 보상) + 하트/XP(성취 보상)를 동시에 제공합니다.
- **부모 최소 개입 원칙**: AI 에이전트가 레벨 판단, 미션 추천, 코칭 메시지를 자동으로 처리합니다.

### 레벨 구조 요약
| 레벨 | 이름 | 핵심 개념 | 권장 연령 |
|------|------|-----------|-----------|
| Lv.0 | 씨앗 | 행동-보상 연결 | 3~4세 |
| Lv.1 | 새싹 | 교환의 개념 | 4~5세 |
| Lv.2 | 교환사 | 실물 화폐 교환 | 5~6세 |
| Lv.3 | 저축왕 | 저축과 목표 설정 | 6~7세 |
| Lv.4 | 나눔이 | 증여와 나눔 | 7~8세 |
| Lv.5 | 투자가 | 투자와 리스크 | 8~10세 |

### 승급 자동 판단 기준 (공통)
1. 해당 레벨 미션 누적 달성률 ≥ 80%
2. EQ 개념 지수 해당 레벨 기준치 이상
3. 유지 기간 ≥ 14일

---

## [LEVEL-000] Lv.0 씨앗 단계 — 행동-보상 연결

```
chunk_id: LEVEL-000
chunk_type: level_definition
tags: [level_0, 씨앗, 행동보상, 수개념, 3세, 4세]
retrieval_trigger: [레벨 0, 씨앗, 처음 시작, 크레딧이 뭐야, 3세, 4세, 행동 보상]
parent_chunk: META-001
```

### 학습 목표
- 미션을 수행하면 크레딧이 생긴다는 인과관계 인식
- 숫자가 올라가는 시각적 경험 (수 개념 자연 노출)
- 앱과 캐릭터에 흥미 형성

### 핵심 경제 개념
- **노동의 개념**: 내가 무언가를 하면 대가가 생긴다
- **보상의 개념**: 잘한 일에는 좋은 것이 따라온다

### 경제 EQ 목표 수치 (승급 기준)
- 만족 지연 지수: 기준 없음 (이 단계는 즉각 보상)
- 루틴 완주율: ≥ 50%
- 소비 vs 저축 비중: 측정 안 함

### 앱 UX 핵심 포인트
- 미션 완료 시 크레딧 숫자 카운팅 애니메이션
- 캐릭터 칭찬 멘트: "와, 크레딧이 생겼어! 대단한걸?"
- 현재 크레딧 숫자를 항상 크고 명확하게 화면 상단 표시

### 승급 자동 판단 조건
- 미션 누적 완료 횟수 ≥ 10회
- 루틴 완주율 ≥ 50% (최근 14일 기준)
- 자동 승급 가능 (부모 알림 발송 후 72시간 내 거부 없으면 자동 승급)

---

## [MISSION-000] Lv.0 추천 미션 목록

```
chunk_id: MISSION-000
chunk_type: mission_pool
tags: [level_0, mission, 씨앗, 루틴, 생활습관]
retrieval_trigger: [레벨 0 미션, 씨앗 미션, 3세 미션, 4세 미션, 오늘의 미션 추천]
parent_chunk: LEVEL-000
```

| 미션명 | 크레딧 | 하트 | 개념태그 | 난이도 | 반복주기 |
|--------|--------|------|----------|--------|----------|
| 이불 개기 | 1 | 1 | 노동 | 쉬움 | 매일 |
| 밥 먹기 완료 | 1 | 1 | 노동 | 쉬움 | 매일 |
| 손 씻기 | 1 | 1 | 노동 | 쉬움 | 매일 |
| 장난감 정리 | 2 | 1 | 노동 | 보통 | 매일 |
| 인사하기 | 1 | 1 | 노동 | 쉬움 | 매일 |
| 옷 스스로 입기 | 2 | 2 | 노동 | 보통 | 매일 |

### 미션 추천 알고리즘 (Lv.0)
- 하루 3개 미션 제공
- 쉬운 미션 2개 + 보통 미션 1개 조합
- 연속 3일 달성 시 도전 미션 1개 추가 노출
- 미완료 미션은 다음날 재추천 (3일 연속 미완료 시 더 쉬운 미션으로 교체)

---

## [COACHING-000] Lv.0 코칭 메시지 템플릿

```
chunk_id: COACHING-000
chunk_type: coaching_message
tags: [level_0, coaching, 칭찬, 격려]
retrieval_trigger: [코칭 메시지, 칭찬 문구, 격려 문구, 레벨 0]
parent_chunk: LEVEL-000
```

### 상황별 메시지

**미션 완료 직후**
- "야호! 크레딧이 {credit}개 생겼어! 정말 대단한걸? 🎉"
- "와~ {child_name}가 해냈어! 크레딧이 쌓이고 있어!"

**연속 달성 (스트릭)**
- "{streak_days}일 연속이야! 진짜 대단한걸? 🔥"

**첫 미션 완료 (온보딩)**
- "안녕! 오늘 처음으로 크레딧이 생겼어! 미션 할 때마다 크레딧이 쌓일 거야!"

**미션 미완료 독려**
- "오늘 {mission_name} 아직 남았어! 같이 해볼까? 💪"

**승급 알림**
- "와와와! {child_name} 레벨이 올랐어! 이제 {next_level_name} 단계야! 🌟"

---

## [LEVEL-001] Lv.1 새싹 단계 — 교환의 개념

```
chunk_id: LEVEL-001
chunk_type: level_definition
tags: [level_1, 새싹, 교환, 가격, 수량비교, 4세, 5세]
retrieval_trigger: [레벨 1, 새싹, 교환, 가격, 크레딧으로 살 수 있어, 4세, 5세]
parent_chunk: META-001
```

### 학습 목표
- 크레딧이 원하는 것과 교환된다는 개념 인식
- 크레딧 수량 비교 (많다/적다, 부족하다/충분하다)
- 갖고 싶은 것을 위해 잠깐 기다리는 경험

### 핵심 경제 개념
- **화폐의 기능**: 크레딧으로 원하는 것을 살 수 있다
- **가격 개념**: 물건마다 필요한 크레딧이 다르다
- **수량 비교**: 내 크레딧이 가격보다 많은지 적은지 판단

### 경제 EQ 목표 수치 (승급 기준)
- 만족 지연 지수: ≥ 30점
- 루틴 완주율: ≥ 60%
- 소비 vs 저축 비중: 측정 시작

### 인앱 스토어 (Lv.1 전용 디지털 아이템)
- 캐릭터 코스튬 아이템 (15 크레딧)
- 스티커 팩 (10 크레딧)
- 배경화면 테마 (20 크레딧)
- 유튜브 30분 이용권 (20 크레딧) — 부모 사전 설정 필요
- 디저트 선택권 (15 크레딧) — 부모 사전 설정 필요

### 핵심 UX: 부족분 시각화
- 상품 가격과 현재 크레딧을 나란히 막대그래프로 비교
- "10개 더 모으면 살 수 있어!" 자동 계산 표시

### 승급 자동 판단 조건
- 인앱 스토어 구매 ≥ 3회
- 루틴 완주율 ≥ 60% (최근 14일)
- 만족 지연 지수 ≥ 30점

---

## [MISSION-001] Lv.1 추천 미션 목록

```
chunk_id: MISSION-001
chunk_type: mission_pool
tags: [level_1, mission, 새싹, 사회적행동, 학습]
retrieval_trigger: [레벨 1 미션, 새싹 미션, 4세 미션, 5세 미션]
parent_chunk: LEVEL-001
```

| 미션명 | 크레딧 | 하트 | 개념태그 | 난이도 | 반복주기 |
|--------|--------|------|----------|--------|----------|
| 동생 도와주기 | 3 | 1 | 사회 | 보통 | 매일 |
| 책 읽기 10분 | 2 | 1 | 학습 | 보통 | 매일 |
| 심부름 하기 | 3 | 2 | 노동 | 보통 | 주3회 |
| 새로운 음식 먹어보기 | 5 | 3 | 도전 | 어려움 | 수시 |
| 혼자 씻기 | 3 | 2 | 자립 | 보통 | 매일 |
| 일찍 자기 | 2 | 1 | 습관 | 보통 | 매일 |
| 그림 그리기 완성 | 3 | 2 | 창의 | 보통 | 수시 |

### 미션 추천 알고리즘 (Lv.1)
- 하루 3~4개 미션 제공
- EQ 만족 지연 지수 낮으면 → 소액 크레딧 미션 여러 개로 잦은 성취감
- EQ 만족 지연 지수 높으면 → 고액 크레딧 미션 1개로 목표 집중

---

## [LEVEL-002] Lv.2 교환사 단계 — 실물 화폐 교환

```
chunk_id: LEVEL-002
chunk_type: level_definition
tags: [level_2, 교환사, 실물교환, 시장, 배송, 5세, 6세]
retrieval_trigger: [레벨 2, 교환사, 실물, 진짜 물건, 집에 와, 5세, 6세, 구매 요청]
parent_chunk: META-001
```

### 학습 목표
- 사이버 크레딧이 진짜 물건으로 교환된다는 경험
- 구매 요청 → 대기 → 수령의 과정 체험
- 배송을 기다리는 지연 만족 훈련

### 핵심 경제 개념
- **실물 화폐 교환**: 디지털 크레딧이 물리적 가치로 전환됨
- **시장의 개념**: 원하는 것을 크레딧으로 살 수 있는 공간(마켓)이 있다
- **유통의 개념**: 주문하면 물건이 이동해서 집에 온다

### 실물 교환 플로우
1. 아이가 앱 마켓에서 상품 선택 + 구매 요청 버튼 탭
2. 부모 앱에 알림 발송 → 부모 승인/거절
3. 부모가 실제 구매 또는 준비
4. 앱에서 "준비 중 → 배송 중 → 도착!" 상태 업데이트
5. 아이가 수령 확인 버튼 → 캐릭터 축하 이벤트

### 부모 자동화 설정 옵션
- 월 예산 한도 설정 시 한도 내 자동 승인 가능
- 특정 카테고리 자동 승인 설정 가능

### 경제 EQ 목표 수치 (승급 기준)
- 만족 지연 지수: ≥ 50점
- 루틴 완주율: ≥ 65%
- 소비 vs 저축 비중: 소비 비중 ≤ 90%

### 승급 자동 판단 조건
- 실물 교환 완료 ≥ 2회
- 만족 지연 지수 ≥ 50점
- 루틴 완주율 ≥ 65% (최근 14일)

---

## [MISSION-002] Lv.2 추천 미션 목록

```
chunk_id: MISSION-002
chunk_type: mission_pool
tags: [level_2, mission, 교환사, 꾸준함, 기여]
retrieval_trigger: [레벨 2 미션, 교환사 미션, 5세 미션, 6세 미션]
parent_chunk: LEVEL-002
```

| 미션명 | 크레딧 | 하트 | 개념태그 | 난이도 | 반복주기 |
|--------|--------|------|----------|--------|----------|
| 일주일 미션 개근 보너스 | 20 | 5 | 꾸준함 | 특별 | 주1회 |
| 청소 도와주기 | 5 | 2 | 기여 | 보통 | 주3회 |
| 독서록 쓰기 | 8 | 3 | 학습 | 어려움 | 수시 |
| 운동 30분 | 6 | 2 | 건강 | 보통 | 주3회 |
| 밥상 차리기 도움 | 4 | 2 | 기여 | 보통 | 매일 |
| 일기 쓰기 | 6 | 3 | 창의 | 보통 | 매일 |

---

## [LEVEL-003] Lv.3 저축왕 단계 — 저축과 목표 설정

```
chunk_id: LEVEL-003
chunk_type: level_definition
tags: [level_3, 저축왕, 저축, 목표설정, 기회비용, 지연만족, 6세, 7세]
retrieval_trigger: [레벨 3, 저축왕, 저축, 목표, 모으면 더 큰 것, 기회비용, 6세, 7세]
parent_chunk: META-001
```

### 학습 목표
- 지금 쓰지 않고 모으면 더 큰 가치를 얻는다는 개념
- 목표를 설정하고 달성하는 경험
- 작은 것 vs 큰 것 선택 경험 (기회비용 입문)

### 핵심 경제 개념
- **저축의 개념**: 지금 쓰지 않고 모아두면 나중에 더 큰 것을 살 수 있다
- **목표 지향성**: 원하는 것을 위해 계획을 세우고 실행한다
- **기회비용**: 지금 작은 것을 사면 큰 목표가 멀어진다

### 핵심 기능: 목표 저금통
- 아이가 원하는 상품 선택 → 목표 저금통 생성
- 저금통 채워지는 애니메이션 (진행률 시각화)
- 달성 예상 날짜 자동 계산
- 중간에 다른 것 구매 시 목표 달성일이 늘어나는 것 시각화

### 기회비용 UX
- 저금통 외 구매 시도 시: "지금 사면 {목표상품} 달성일이 {N}일 늦어져. 그래도 살까?"

### 경제 EQ 목표 수치 (승급 기준)
- 만족 지연 지수: ≥ 70점
- 루틴 완주율: ≥ 70%
- 소비 vs 저축 비중: 저축 비중 ≥ 30%

### 승급 자동 판단 조건
- 목표 저금통 달성 ≥ 1회
- 만족 지연 지수 ≥ 70점
- 저축 비중 ≥ 30% (최근 30일)

---

## [MISSION-003] Lv.3 추천 미션 목록

```
chunk_id: MISSION-003
chunk_type: mission_pool
tags: [level_3, mission, 저축왕, 목표, 장기습관]
retrieval_trigger: [레벨 3 미션, 저축왕 미션, 6세 미션, 7세 미션]
parent_chunk: LEVEL-003
```

| 미션명 | 크레딧 | 하트 | 개념태그 | 난이도 | 반복주기 |
|--------|--------|------|----------|--------|----------|
| 목표 저금통 10% 달성 | 10 | 3 | 저축 | 특별 | 수시 |
| 어려운 도전 미션 | 15 | 5 | 도전 | 어려움 | 주2회 |
| 한 달 꾸준히 달성 | 50 | 15 | 꾸준함 | 특별 | 월1회 |
| 스스로 공부 30분 | 10 | 4 | 학습 | 어려움 | 매일 |
| 집안일 프로젝트 | 20 | 7 | 기여 | 어려움 | 주1회 |

---

## [LEVEL-004] Lv.4 나눔이 단계 — 증여와 나눔

```
chunk_id: LEVEL-004
chunk_type: level_definition
tags: [level_4, 나눔이, 증여, 선물, 기부, 공감, 7세, 8세]
retrieval_trigger: [레벨 4, 나눔이, 선물, 기부, 친구에게 주기, 나눔, 7세, 8세]
parent_chunk: META-001
```

### 학습 목표
- 내 크레딧을 타인에게 줄 수 있다는 개념
- 주는 사람도 기쁘다는 경험 (공감 경제)
- 기부의 개념 입문

### 핵심 경제 개념
- **증여의 개념**: 내 것을 타인에게 줄 수 있다
- **선물 경제**: 받는 사람을 위해 소비하는 것도 의미 있다
- **기부의 개념**: 나의 자원으로 사회에 기여할 수 있다

### 핵심 기능: 선물하기
- 친구/가족 COOANC 계정으로 크레딧 전송
- 생일 알림 자동 감지 → 선물 유도
- 선물 카드 직접 꾸미기

### 핵심 기능: 기부하기
- 파트너 NGO 연동
- 기부 결과 시각화 ("내 50크레딧으로 나무 1그루가 심어졌어! 🌳")
- 기부 시 특별 뱃지 지급

### 승급 자동 판단 조건
- 선물하기 ≥ 1회
- 기부하기 ≥ 1회
- 루틴 완주율 ≥ 70% (최근 14일)

---

## [MISSION-004] Lv.4 추천 미션 목록

```
chunk_id: MISSION-004
chunk_type: mission_pool
tags: [level_4, mission, 나눔이, 선물, 기부, 공감]
retrieval_trigger: [레벨 4 미션, 나눔이 미션, 7세 미션, 8세 미션]
parent_chunk: LEVEL-004
```

| 미션명 | 크레딧 | 하트 | 개념태그 | 난이도 | 반복주기 |
|--------|--------|------|----------|--------|----------|
| 친구에게 크레딧 선물하기 | 20 | 8 | 나눔 | 특별 | 수시 |
| 기부 미션 완료 | 15 | 10 | 기부 | 특별 | 월2회 |
| 가족 감사 편지 쓰기 | 10 | 5 | 공감 | 보통 | 주1회 |
| 친구 도와주기 | 8 | 5 | 나눔 | 보통 | 수시 |
| 나눔 일기 쓰기 | 8 | 4 | 공감 | 보통 | 주2회 |

---

## [LEVEL-005] Lv.5 투자가 단계 — 투자와 리스크

```
chunk_id: LEVEL-005
chunk_type: level_definition
tags: [level_5, 투자가, 투자, 리스크, 복리, 의사결정, 8세, 9세, 10세]
retrieval_trigger: [레벨 5, 투자가, 투자, 리스크, 크레딧 불리기, 8세, 9세, 10세]
parent_chunk: META-001
```

### 학습 목표
- 크레딧을 투자하면 늘어날 수도, 줄어들 수도 있다는 개념
- 위험을 감수하는 의사결정 경험
- 시간이 지날수록 가치가 변한다는 개념

### 핵심 경제 개념
- **투자의 개념**: 지금의 자원을 미래의 더 큰 수익을 위해 사용
- **리스크와 리턴**: 높은 수익 가능성에는 높은 위험이 따른다
- **복리의 개념**: 시간이 길수록 이익이 이익을 낳는다

### 핵심 기능: 투자 농장
- 씨앗(크레딧) 투자 → 시간 경과 후 수확
- 작물 종류별 리스크/리턴 차별화:
  - 감자: 낮은 리스크, 낮은 수익 (1주 후 1.2배)
  - 사과: 중간 리스크, 중간 수익 (2주 후 1.5배 or 0.8배)
  - 황금 멜론: 높은 리스크, 높은 수익 (3주 후 2배 or 0.5배)
- 날씨 이벤트로 불확실성 추가

### 경제 EQ 목표 수치
- 만족 지연 지수: ≥ 85점
- 루틴 완주율: ≥ 75%
- 저축 비중: ≥ 40%

---

## [MISSION-005] Lv.5 추천 미션 목록

```
chunk_id: MISSION-005
chunk_type: mission_pool
tags: [level_5, mission, 투자가, 투자, 의사결정]
retrieval_trigger: [레벨 5 미션, 투자가 미션, 8세 미션, 9세 미션, 10세 미션]
parent_chunk: LEVEL-005
```

| 미션명 | 크레딧 | 하트 | 개념태그 | 난이도 | 반복주기 |
|--------|--------|------|----------|--------|----------|
| 투자 농장 씨앗 심기 | 투자수익 | 5 | 투자 | 특별 | 수시 |
| 경제 퀴즈 도전 | 20 | 5 | 학습 | 어려움 | 주2회 |
| 투자 일기 쓰기 | 10 | 3 | 성찰 | 보통 | 주2회 |
| 용돈 예산 계획 세우기 | 15 | 6 | 계획 | 어려움 | 월1회 |
| 가족 경제 토론 참여 | 10 | 5 | 학습 | 보통 | 주1회 |

---

## [EQ-SYSTEM] 경제 EQ 측정 시스템

```
chunk_id: EQ-SYSTEM
chunk_type: eq_measurement
tags: [EQ, 만족지연, 루틴완주율, 저축비중, 측정, 점수]
retrieval_trigger: [EQ, 경제 EQ, 만족 지연, 루틴 완주율, 소비 저축 비중, 점수 계산]
parent_chunk: META-001
```

### EQ 3축 정의 및 계산 방법

**① 만족 지연 지수 (0~100점)**
- 측정 기간: 최근 30일
- 계산식: 활성 저금통 유지 일수 × 3, 최대 100점
- 의미: 즉각적 소비 충동을 억제하고 기다릴 수 있는 능력

**② 루틴 완주율 (0~100%)**
- 측정 기간: 최근 14일
- 계산식: (완료 미션 수 / 제공된 총 미션 수) × 100
- 의미: 꾸준한 습관 형성 능력

**③ 소비 vs 저축 비중 (저축 비중 %)**
- 측정 기간: 최근 30일
- 계산식: (저금통에 적립된 크레딧 / 총 획득 크레딧) × 100
- 의미: 미래를 위한 자원 배분 능력

### EQ 기반 에이전트 행동 규칙

| EQ 약점 | 에이전트 대응 |
|---------|-------------|
| 만족 지연 낮음 | 목표 저금통 미션 우선 추천, 달성 예상일 자주 알림 |
| 루틴 완주율 낮음 | 미션 수 줄이기, 쉬운 미션 비중 높이기 |
| 저축 비중 낮음 | 고크레딧 미션 추천, 저금통 잔고 시각화 강화 |
| 전체 EQ 우수 | 레벨 승급 검토, 도전 미션 노출 |

---

## [AGENT-LOGIC] AI 에이전트 판단 로직

```
chunk_id: AGENT-LOGIC
chunk_type: agent_behavior
tags: [에이전트, 자동화, 미션추천, 승급판단, 로직]
retrieval_trigger: [에이전트 로직, 자동 추천, 승급 판단, AI 판단, 자동화]
parent_chunk: META-001
```

### 에이전트 구성 (4개)

**① 관찰 에이전트** (실시간): 미션 완료 이벤트 수집, EQ 3축 점수 실시간 업데이트

**② 추천 에이전트** (매일 오전 8시):
- 현재 레벨 미션 풀에서 후보 선정
- EQ 약점 분석 → 약점 보완 미션 우선 선택
- 최근 7일 완료율 기반 난이도 조정
- 하루 미션 3~4개 최종 선정

**③ 승급 판단 에이전트** (매일 자정):
- 승급 조건 3가지 동시 충족 여부 확인
- 조건 충족 시 부모 알림 발송
- 72시간 내 부모 거부 없으면 자동 승급

**④ 코칭 에이전트** (이벤트 기반):
- 미션 완료 → 칭찬 메시지 즉시 발송
- 스트릭 달성 → 특별 응원 메시지
- 3일 연속 미완료 → 독려 메시지
- 승급 → 축하 + 다음 레벨 소개

### RAG 검색 우선순위
1. 현재 아이 레벨 청크 (LEVEL-00X)
2. 해당 레벨 미션 풀 청크 (MISSION-00X)
3. EQ 시스템 청크 (EQ-SYSTEM)
4. 코칭 메시지 청크 (COACHING-00X)

---

## [BADGE-SYSTEM] 뱃지 및 게임화 시스템

```
chunk_id: BADGE-SYSTEM
chunk_type: gamification
tags: [뱃지, 게임화, 랭킹, 스트릭, 성취감]
retrieval_trigger: [뱃지, 랭킹, 스트릭, 게임화, 성취감, 레벨업]
parent_chunk: META-001
```

### 레벨별 승급 뱃지
| 레벨 | 뱃지명 | 아이콘 | 획득 조건 |
|------|--------|--------|-----------|
| Lv.0 | 첫 크레딧 | 🪙 | 첫 미션 완료 |
| Lv.1 | 첫 구매 | 🛒 | 첫 스토어 구매 |
| Lv.2 | 첫 실물교환 | 📦 | 첫 실물 수령 |
| Lv.3 | 목표 달성자 | 🎯 | 저금통 목표 달성 |
| Lv.4 | 나눔 영웅 | 💝 | 선물+기부 완료 |
| Lv.5 | 투자가 | 🚀 | 투자 농장 수확 |

### 특별 뱃지
- 🔥 **불꽃 스트릭**: 7일/30일/100일 연속 달성
- 🌟 **EQ 마스터**: EQ 3축 모두 목표치 달성
- 👑 **또래 1위**: 주간 랭킹 1위
- 🌳 **지구 지킴이**: 기부 누적 100크레딧 이상
- 🎁 **선물 요정**: 선물하기 5회 이상

### 랭킹 시스템
- 주간 랭킹 / EQ 랭킹 / 뱃지 랭킹
- 범위: 전체 / 또래(같은 레벨) / 친구
- 부모가 ON/OFF 설정 가능

---

# Part 2. DB 스키마 + 구현 명세

> **현재 상태**: Supabase 프로젝트 생성 완료, Auth 설정 완료, Next.js 연동 완료
> **미완료**: 실제 서비스 테이블 미생성 (connection_test 임시 테이블만 존재)
> **앱 구조**: 단일 Next.js 프로젝트 내 아이/부모 모드 분리

---

## STEP 1. 데이터베이스 스키마 전체 생성

아래 SQL을 Supabase SQL Editor에서 순서대로 실행하세요.

### 1-1. 확장 기능 활성화

```sql
create extension if not exists vector;
create extension if not exists "uuid-ossp";
```

### 1-2. 사용자 프로필 (profiles)

```sql
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('parent', 'child')),
  name         text not null,
  avatar_url   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, role, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'parent'),
    coalesce(new.raw_user_meta_data->>'name', '사용자')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

### 1-3. 가족 연결 (family_links)

```sql
create table family_links (
  id          uuid primary key default uuid_generate_v4(),
  parent_id   uuid not null references profiles(id) on delete cascade,
  child_id    uuid not null references profiles(id) on delete cascade,
  nickname    text,
  created_at  timestamptz default now(),
  unique (parent_id, child_id)
);
```

### 1-4. 자녀 경제 프로필 (child_stats)

```sql
create table child_stats (
  id                    uuid primary key default uuid_generate_v4(),
  child_id              uuid unique not null references profiles(id) on delete cascade,
  credits               int not null default 0 check (credits >= 0),
  hearts                int not null default 0 check (hearts >= 0),
  total_credits_earned  int not null default 0,
  current_level         int not null default 0 check (current_level between 0 and 5),
  exp                   int not null default 0,
  exp_to_next_level     int not null default 100,
  eq_delay_score        int not null default 0,
  eq_routine_rate       int not null default 0,
  eq_save_ratio         int not null default 0,
  streak_days           int not null default 0,
  last_mission_date     date,
  longest_streak        int not null default 0,
  promotion_pending     boolean default false,
  promotion_eligible_at timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);
```

### 1-5. 미션 정의 (missions)

```sql
create table missions (
  id              uuid primary key default uuid_generate_v4(),
  level_required  int not null default 0 check (level_required between 0 and 5),
  title           text not null,
  description     text,
  icon_emoji      text default '✅',
  credit_reward   int not null default 1 check (credit_reward >= 0),
  heart_reward    int not null default 1 check (heart_reward >= 0),
  exp_reward      int not null default 10,
  concept_tag     text check (concept_tag in (
                    '노동','교환','저축','나눔','투자','도전','학습','기여','건강','습관'
                  )),
  difficulty      text not null default 'normal'
                    check (difficulty in ('easy','normal','hard','special')),
  repeat_type     text not null default 'daily'
                    check (repeat_type in ('daily','weekly','monthly','event')),
  is_active       boolean default true,
  created_at      timestamptz default now()
);

insert into missions (level_required, title, credit_reward, heart_reward, exp_reward, concept_tag, difficulty, repeat_type, icon_emoji) values
  (0,'이불 개기',1,1,10,'노동','easy','daily','🛏️'),
  (0,'밥 먹기 완료',1,1,10,'노동','easy','daily','🍳'),
  (0,'손 씻기',1,1,10,'노동','easy','daily','🧼'),
  (0,'장난감 정리',2,1,15,'노동','normal','daily','🧸'),
  (0,'인사하기',1,1,10,'노동','easy','daily','👋'),
  (0,'옷 스스로 입기',2,2,20,'노동','normal','daily','👕'),
  (1,'동생 도와주기',3,1,25,'기여','normal','daily','🤝'),
  (1,'책 읽기 10분',2,1,20,'학습','normal','daily','📚'),
  (1,'심부름 하기',3,2,25,'노동','normal','weekly','🏃'),
  (1,'새 음식 먹어보기',5,3,40,'도전','hard','event','🍽️'),
  (1,'혼자 씻기',3,2,25,'습관','normal','daily','🛁'),
  (2,'청소 도와주기',5,2,35,'기여','normal','weekly','🧹'),
  (2,'독서록 쓰기',8,3,50,'학습','hard','event','📝'),
  (2,'운동 30분',6,2,40,'건강','normal','weekly','🏋️'),
  (2,'일주일 개근 보너스',20,5,100,'습관','special','weekly','🎯'),
  (3,'목표 저금통 10% 달성',10,3,60,'저축','special','event','🐷'),
  (3,'스스로 공부 30분',10,4,60,'학습','hard','daily','📖'),
  (3,'한 달 꾸준히 달성',50,15,200,'습관','special','monthly','🏆'),
  (4,'친구에게 크레딧 선물',20,8,80,'나눔','special','event','🎁'),
  (4,'기부 미션',15,10,70,'나눔','special','monthly','🌳'),
  (4,'가족 감사 편지',10,5,50,'나눔','normal','weekly','💌'),
  (5,'투자 농장 씨앗 심기',0,5,30,'투자','special','event','🌱'),
  (5,'경제 퀴즈 도전',20,5,80,'학습','hard','weekly','🧠'),
  (5,'용돈 예산 계획',15,6,70,'저축','hard','monthly','📊');
```

### 1-6. 미션 수행 로그 (mission_logs)

```sql
create table mission_logs (
  id              uuid primary key default uuid_generate_v4(),
  child_id        uuid not null references profiles(id) on delete cascade,
  mission_id      uuid not null references missions(id),
  assigned_date   date not null default current_date,
  is_completed    boolean default false,
  completed_at    timestamptz,
  credit_earned   int default 0,
  heart_earned    int default 0,
  exp_earned      int default 0,
  created_at      timestamptz default now(),
  unique (child_id, mission_id, assigned_date)
);

create index idx_mission_logs_child_date on mission_logs (child_id, assigned_date desc);
create index idx_mission_logs_child_completed on mission_logs (child_id, is_completed, assigned_date desc);
```

### 1-7. 미션 완료 트리거 (보안 핵심 — 프론트 조작 차단)

```sql
create or replace function on_mission_completed()
returns trigger language plpgsql security definer as $$
declare
  v_mission missions%rowtype;
  v_stats   child_stats%rowtype;
begin
  if new.is_completed = true and old.is_completed = false then
    select * into v_mission from missions where id = new.mission_id;
    new.credit_earned := v_mission.credit_reward;
    new.heart_earned  := v_mission.heart_reward;
    new.exp_earned    := v_mission.exp_reward;
    new.completed_at  := now();

    update child_stats set
      credits              = credits + v_mission.credit_reward,
      hearts               = hearts + v_mission.heart_reward,
      exp                  = exp + v_mission.exp_reward,
      total_credits_earned = total_credits_earned + v_mission.credit_reward,
      last_mission_date    = current_date,
      updated_at           = now()
    where child_id = new.child_id;

    select * into v_stats from child_stats where child_id = new.child_id;
    if v_stats.last_mission_date = current_date - interval '1 day' then
      update child_stats set
        streak_days    = streak_days + 1,
        longest_streak = greatest(longest_streak, streak_days + 1)
      where child_id = new.child_id;
    elsif v_stats.last_mission_date < current_date - interval '1 day' then
      update child_stats set streak_days = 1 where child_id = new.child_id;
    end if;

    select * into v_stats from child_stats where child_id = new.child_id;
    if v_stats.exp >= v_stats.exp_to_next_level and v_stats.current_level < 5 then
      update child_stats set
        current_level         = current_level + 1,
        exp                   = exp - exp_to_next_level,
        exp_to_next_level     = exp_to_next_level * 2,
        promotion_pending     = true,
        promotion_eligible_at = now()
      where child_id = new.child_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger mission_completed_trigger
  before update on mission_logs
  for each row execute procedure on_mission_completed();
```

### 1-8. 저금통 목표 (savings_goals)

```sql
create table savings_goals (
  id              uuid primary key default uuid_generate_v4(),
  child_id        uuid not null references profiles(id) on delete cascade,
  title           text not null,
  target_credits  int not null check (target_credits > 0),
  saved_credits   int not null default 0 check (saved_credits >= 0),
  status          text not null default 'active'
                    check (status in ('active','achieved','cancelled')),
  item_image_url  text,
  achieved_at     timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

### 1-9. 마켓 상품 (store_items) + 구매 요청 (purchase_requests)

```sql
create table store_items (
  id              uuid primary key default uuid_generate_v4(),
  family_link_id  uuid references family_links(id) on delete cascade,
  name            text not null,
  description     text,
  image_url       text,
  credit_price    int not null check (credit_price > 0),
  item_type       text not null default 'digital'
                    check (item_type in ('digital','real')),
  category        text check (category in ('food','toy','activity','digital','experience')),
  level_required  int not null default 0,
  is_active       boolean default true,
  stock           int default null,
  created_at      timestamptz default now()
);

create table purchase_requests (
  id              uuid primary key default uuid_generate_v4(),
  child_id        uuid not null references profiles(id) on delete cascade,
  item_id         uuid references store_items(id),
  item_name       text not null,
  item_price      int not null,
  item_type       text not null,
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected','delivered')),
  child_message   text,
  parent_note     text,
  requested_at    timestamptz default now(),
  approved_at     timestamptz,
  delivered_at    timestamptz
);

-- 구매 승인 시 크레딧 자동 차감 트리거
create or replace function on_purchase_approved()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    if (select credits from child_stats where child_id = new.child_id) < new.item_price then
      raise exception '크레딧이 부족합니다.';
    end if;
    update child_stats set
      credits    = credits - new.item_price,
      updated_at = now()
    where child_id = new.child_id;
    new.approved_at := now();
  end if;
  return new;
end;
$$;

create trigger purchase_approved_trigger
  before update on purchase_requests
  for each row execute procedure on_purchase_approved();
```

### 1-10. 뱃지 (badges + child_badges)

```sql
create table badges (
  id          uuid primary key default uuid_generate_v4(),
  badge_id    text unique not null,
  name        text not null,
  description text,
  icon_emoji  text,
  badge_type  text check (badge_type in ('level','streak','eq','special')),
  condition   jsonb
);

create table child_badges (
  id          uuid primary key default uuid_generate_v4(),
  child_id    uuid not null references profiles(id) on delete cascade,
  badge_id    text not null references badges(badge_id),
  earned_at   timestamptz default now(),
  unique (child_id, badge_id)
);

insert into badges (badge_id, name, icon_emoji, badge_type, condition) values
  ('first_credit',  '첫 크레딧',   '🪙','level',  '{"event":"first_mission_complete"}'),
  ('first_purchase','첫 구매',     '🛒','level',  '{"event":"first_purchase"}'),
  ('first_real',    '첫 실물교환', '📦','level',  '{"event":"first_real_purchase"}'),
  ('goal_achieved', '목표 달성자', '🎯','level',  '{"event":"savings_goal_achieved"}'),
  ('sharing_hero',  '나눔 영웅',   '💝','level',  '{"gift_count":1,"donation_count":1}'),
  ('investor',      '투자가',      '🚀','level',  '{"event":"farm_harvest"}'),
  ('streak_7',      '7일 스트릭',  '🔥','streak', '{"streak_days":7}'),
  ('streak_30',     '30일 스트릭', '🔥','streak', '{"streak_days":30}'),
  ('eq_master',     'EQ 마스터',   '🌟','eq',     '{"all_eq_above":70}'),
  ('earth_keeper',  '지구 지킴이', '🌳','special','{"total_donation":100}');
```

### 1-11. RAG 커리큘럼 테이블 (curriculum_chunks)

```sql
create table curriculum_chunks (
  id          uuid primary key default uuid_generate_v4(),
  chunk_id    text unique not null,
  chunk_type  text not null,
  content     text not null,
  embedding   vector(1536),
  tags        text[] default '{}',
  metadata    jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index curriculum_chunks_embedding_idx
  on curriculum_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function search_curriculum(
  query_embedding  vector(1536),
  match_threshold  float   default 0.7,
  match_count      int     default 5,
  filter_type      text    default null,
  filter_level     int     default null
)
returns table (chunk_id text, chunk_type text, content text, tags text[], similarity float)
language plpgsql as $$
begin
  return query
  select cc.chunk_id, cc.chunk_type, cc.content, cc.tags,
    1 - (cc.embedding <=> query_embedding) as similarity
  from curriculum_chunks cc
  where
    (filter_type  is null or cc.chunk_type = filter_type)
    and (filter_level is null or (cc.metadata->>'level')::int = filter_level)
    and 1 - (cc.embedding <=> query_embedding) > match_threshold
  order by cc.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

### 1-12. EQ 지수 자동 계산 함수

```sql
create or replace function recalculate_eq(p_child_id uuid)
returns void language plpgsql security definer as $$
declare
  v_total_assigned  int;
  v_total_completed int;
  v_routine_rate    int;
  v_earned_30d      int;
  v_saved_30d       int;
  v_save_ratio      int;
  v_goal_days       int;
  v_delay_score     int;
begin
  select count(*), count(*) filter (where is_completed = true)
  into v_total_assigned, v_total_completed
  from mission_logs
  where child_id = p_child_id
    and assigned_date >= current_date - interval '14 days';

  v_routine_rate := case
    when v_total_assigned = 0 then 0
    else (v_total_completed * 100 / v_total_assigned)
  end;

  select coalesce(sum(credit_earned), 0) into v_earned_30d
  from mission_logs
  where child_id = p_child_id
    and assigned_date >= current_date - interval '30 days'
    and is_completed = true;

  select coalesce(sum(saved_credits), 0) into v_saved_30d
  from savings_goals
  where child_id = p_child_id
    and created_at >= current_date - interval '30 days';

  v_save_ratio := case
    when v_earned_30d = 0 then 0
    else least((v_saved_30d * 100 / v_earned_30d), 100)
  end;

  select coalesce(extract(day from now() - min(created_at))::int, 0)
  into v_goal_days
  from savings_goals
  where child_id = p_child_id and status = 'active';

  v_delay_score := least(v_goal_days * 3, 100);

  update child_stats set
    eq_routine_rate = v_routine_rate,
    eq_save_ratio   = v_save_ratio,
    eq_delay_score  = v_delay_score,
    updated_at      = now()
  where child_id = p_child_id;
end;
$$;
```

### 1-13. Row Level Security (RLS)

```sql
alter table profiles           enable row level security;
alter table family_links       enable row level security;
alter table child_stats        enable row level security;
alter table mission_logs       enable row level security;
alter table purchase_requests  enable row level security;
alter table savings_goals      enable row level security;
alter table store_items        enable row level security;
alter table child_badges       enable row level security;
alter table curriculum_chunks  enable row level security;

create policy "profiles_self" on profiles
  for all using (auth.uid() = id);

create policy "family_links_member" on family_links
  for all using (auth.uid() = parent_id or auth.uid() = child_id);

create policy "child_stats_access" on child_stats
  for all using (
    auth.uid() = child_id
    or exists (select 1 from family_links where parent_id = auth.uid() and child_id = child_stats.child_id)
  );

create policy "mission_logs_access" on mission_logs
  for all using (
    auth.uid() = child_id
    or exists (select 1 from family_links where parent_id = auth.uid() and child_id = mission_logs.child_id)
  );

create policy "purchase_requests_access" on purchase_requests
  for all using (
    auth.uid() = child_id
    or exists (select 1 from family_links where parent_id = auth.uid() and child_id = purchase_requests.child_id)
  );

create policy "savings_goals_access" on savings_goals
  for all using (
    auth.uid() = child_id
    or exists (select 1 from family_links where parent_id = auth.uid() and child_id = savings_goals.child_id)
  );

create policy "store_items_read" on store_items
  for select using (auth.role() = 'authenticated');

-- curriculum_chunks: service_role만 접근 (에이전트 전용, 보안 핵심)
create policy "curriculum_service_only" on curriculum_chunks
  for all using (auth.role() = 'service_role');

create policy "child_badges_access" on child_badges
  for all using (
    auth.uid() = child_id
    or exists (select 1 from family_links where parent_id = auth.uid() and child_id = child_badges.child_id)
  );
```

### 1-14. Realtime 활성화

```sql
alter publication supabase_realtime add table mission_logs;
alter publication supabase_realtime add table purchase_requests;
alter publication supabase_realtime add table child_stats;
```

---

## STEP 2. RAG 임베딩 파이프라인

Part 1 전체를 `cooanc_rag_knowledge_base.md`로 저장 후 아래 스크립트로 임베딩:

```python
# scripts/ingest_curriculum.py
import re, os
from openai import OpenAI
from supabase import create_client

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
openai   = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

def parse_chunks(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    chunks = []
    for section in re.split(r'\n## ', content)[1:]:
        lines   = section.strip().split('\n')
        header  = lines[0]
        meta    = re.search(r'```\n(chunk_id:.*?)\n```', section, re.DOTALL)
        chunk_id, chunk_type, tags, metadata = header, "general", [], {}
        if meta:
            for line in meta.group(1).strip().split('\n'):
                if line.startswith('chunk_id:'):   chunk_id   = line.split(':',1)[1].strip()
                elif line.startswith('chunk_type:'): chunk_type = line.split(':',1)[1].strip()
                elif line.startswith('tags:'):       tags       = re.findall(r'[\w가-힣_]+', line.split(':',1)[1])
        m = re.search(r'LEVEL-(\d+)|MISSION-(\d+)', chunk_id)
        if m: metadata['level'] = int(next(g for g in m.groups() if g))
        chunks.append({"chunk_id": chunk_id, "chunk_type": chunk_type,
                       "content": f"## {section.strip()}", "tags": tags, "metadata": metadata})
    return chunks

def embed_and_store(chunks):
    for chunk in chunks:
        emb = openai.embeddings.create(model="text-embedding-3-small", input=chunk["content"])
        supabase.table("curriculum_chunks").upsert(
            {**chunk, "embedding": emb.data[0].embedding}, on_conflict="chunk_id"
        ).execute()
        print(f"✅ {chunk['chunk_id']}")

if __name__ == "__main__":
    chunks = parse_chunks("cooanc_rag_knowledge_base.md")
    embed_and_store(chunks)
    print("🎉 완료!")
```

---

## STEP 3. Next.js 연동 포인트

```env
# .env.local 추가 항목
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # 서버사이드 전용 (NEXT_PUBLIC 금지)
OPENAI_API_KEY=sk-...
```

```typescript
// Realtime 구독 예시 (아이 앱 — 구매 승인 감지)
const channel = supabase
  .channel('purchase_updates')
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public',
    table: 'purchase_requests',
    filter: `child_id=eq.${childId}`,
  }, (payload) => {
    if (payload.new.status === 'approved') {
      // 크레딧 차감 + 축하 애니메이션
    }
  }).subscribe()
```

---

## STEP 4. 개발 가드레일 (필수 준수)

```
1. 크레딧 증감은 반드시 DB 트리거로만 처리 — 프론트에서 child_stats 직접 UPDATE 금지
2. curriculum_chunks 테이블은 service_role만 접근 — anon/authenticated 키로 접근 시 RLS 차단
3. EQ 지수 계산은 recalculate_eq() 함수 경유 필수 — 직접 eq_* 컬럼 UPDATE 금지
4. Realtime 구독은 mission_logs, purchase_requests, child_stats 3개 테이블만 활성화
```

---

## 완료 후 검증 체크리스트

```
□ 모든 테이블 생성 확인 (Supabase Table Editor)
□ 미션 완료 트리거 테스트: mission_logs is_completed=true → child_stats.credits 증가 확인
□ 구매 승인 트리거 테스트: purchase_requests status='approved' → credits 차감 확인
□ RLS 테스트: anon 유저로 profiles 조회 시 빈 배열 반환 확인
□ curriculum_chunks에 Part 1 전체 임베딩 완료 (14개 청크) 확인
□ search_curriculum() 함수 검색 결과 반환 확인
□ Realtime 구독 후 mission_logs 업데이트 시 클라이언트 이벤트 수신 확인
```
