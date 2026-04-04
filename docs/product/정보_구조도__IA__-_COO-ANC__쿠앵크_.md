# 정보 구조도 (IA) - COO-ANC (쿠앵크)

## 1. 개요

본 정보 구조도(IA)는 4-11세 자녀를 위한 생활 습관 및 경제 교육 웹 앱인 'COO-ANC (쿠앵크)'의 콘텐츠 및 기능 계층 구조를 정의합니다. 부모와 자녀 각각의 사용자 경험을 최적화하기 위해 듀얼 UI를 기반으로 설계되었으며, 모듈형 개발의 확장성을 고려하여 핵심 모듈(루틴, 보상, 상점)을 중심으로 구성됩니다.

## 2. 주요 사용자 흐름

### 2.1. 부모 사용자 흐름

1.  **회원가입/로그인**: 부모 계정 생성 및 로그인
2.  **AI 온보딩**: 초기 온보딩 시 AI 챗봇과의 대화형 설문을 통해 자녀의 기본 루틴(기상 시간, 주말 알람 여부 등)을 설정하고, 평일/주말/방학/기념일 등 연간 일정을 관리합니다.
3.  **루틴 매니저 (AI)**: 부모 화면에 플로팅 아이콘으로 AI 챗봇을 제공하며, 클릭 시 대화창 활성화. 챗봇은 미션 설정, 알람 설정, 연간 일정 관리 키워드 리스트를 선제적으로 보여주어 대화형으로 루틴을 수정/관리합니다. 자연어(텍스트)로 루틴을 입력하면 AI가 자동으로 루틴 카드를 생성 및 배치하며, 미션 카드는 온오프, 드래그 앤 드롭으로 순서 변경, 삭제/추가 기능이 제공됩니다. 연간 일정에 따라 자녀 앱에 스페셜 팝업이 노출됩니다.
4.  **자녀 계정 생성 및 관리**: 자녀 프로필 생성, 연령 설정, 캐릭터 선택, 미션 설정.
5.  **대시보드**: 자녀 활동 모니터링, Credit/EXP 현황, AI 행동 분석 요약 및 가이드 확인, 오늘의 특이사항 알림.
6.  **승인 시스템**: 자녀의 마켓 구매 요청 실시간 알림 및 승인/반려 처리. 반려 시 **반려 사유** 입력. 자녀의 미션 완료를 **롤백(Rollback)**하여 미완료 상태로 되돌릴 수 있습니다.
7.  **설정**: 계정 정보, 알림 설정, 자녀 모드 수동 전환 등.
8.  **커뮤니티 (확장 계획)**: 육아 및 경제 교육 정보 공유, 부모 간 소통을 위한 커뮤니티 기능.

### 2.2. 자녀 사용자 흐름

1.  **로그인**: 부모를 통한 로그인 또는 간편 로그인
2.  **메인 화면**: 내 캐릭터 확인, 오늘의 미션 확인
3.  **데일리 미션 수행**: 미션 선택, 수행, 완료 처리. 완료 클릭 시 **정직 확인 카드** 노출. 정직하게 완료 시 EXP 즉시 획득 및 애니메이션, Credit 저금통 적립. 미션 완료 시 도파민 유발 그린라이트 효과 (콘페티, 꽃다발, 폭죽 애니메이션 및 효과음) 제공.
4.  **이중 보상 시스템**: 미션 완료 보상으로 EXP (캐릭터 성장 및 꾸미기 아이템 해금) 및 Credit (실물 구매 재화) 획득. 저금통에 Credit 보관 및 잔액 확인. EXP는 즉각적인 보상으로 캐릭터 꾸미기 아이템 해금에 사용되며, Credit은 실물 간식/장난감 구매에 사용됩니다.
5.  **마켓**: Credit을 이용한 간식/학용품 검색 및 구매 요청 (자물쇠/활성화 시각화). 부모 승인 시 **딜리버리 화면** 노출.
6.  **캐릭터 꾸미기**: EXP를 통한 캐릭터 성장 및 꾸미기 아이템 해금/착용. 홈 탭에서 캐릭터와 상호작용하며, 다양한 아이템을 드래그 앤 드롭으로 착용/해제합니다.
7.  **칭찬 스티커 시스템**: 특별 미션 완료 시 디지털 칭찬 스티커 발행. 자녀가 직접 스티커를 드래그하여 곰돌이 스티커 판에 붙이는 인터랙션 제공.
8.  **소셜 기능 (확장 계획)**: 크레딧 선물/교환, 랭킹 시스템을 통해 친구와 상호작용.

## 3. 정보 구조 상세

### 3.1. 부모용 대시보드 (Parent UI) - 3탭 구조

| 탭 구분 | 핵심 역할 (Concept) | 주요 구성 요소 |
| :--- | :--- | :--- |
| **1. 홈 (모니터링)** | **우리 아이 현황판** | 자녀별 요약 정보 (이름, 연령, 현재 크레딧, EXP), 미션 달성률, AI 행동 분석 요약, 최근 활동 로그, 오늘의 특이사항 (휴일 등) 알림 |
| **2. 루틴 매니저 (AI)** | **말 한마디로 끝내는 설정** | AI 챗봇 기반 온보딩 및 루틴 설정, 플로팅 아이콘, 키워드 기반 대화, 미션 카드 관리 (드래그앤드롭, 온/오프), 연간 일정 관리(휴일, 기념일 등) |
| **3. 승인 & 큐레이션** | **검증된 보상과 결제** | 자녀의 구매 요청 목록 (승인/반려 및 반려 사유 입력), 미션 롤백 기능, 부모 전용 큐레이션 커머스, **간식 노출 제어 (간식 창고)** |
| **4. 커뮤니티 (확장 계획)** | **함께 키우는 경제 습관** | 육아 및 경제 교육 정보 공유 게시판, 부모 간 소통 기능 |

#### 3.1.1. 홈 탭 (모니터링)
*   **자녀 카드**: 여러 자녀가 있을 경우 스와이프로 전환하며, 각 자녀의 캐릭터, 이름, 현재 크레딧, EXP 레벨, **현재 레벨(예: Lv.1 새싹)**을 한눈에 보여줍니다.
*   **경제 EQ 지수**: 자녀의 경제 EQ 지수 및 레벨별 목표 달성 현황을 시각적으로 제공합니다.
*   **미션 달성률**: 주간/월간 미션 달성률 그래프를 통해 자녀의 꾸준함을 시각적으로 보여줍니다.
*   **AI 행동 분석 요약**: 자녀의 소비/저축 성향, 미션 완수 패턴 등을 AI가 분석하여 간략하게 요약 제공합니다.
*   **최근 활동 로그**: 자녀의 미션 완료, 크레딧 사용, 마켓 요청 등 최근 활동 내역을 시간 순으로 보여줍니다.
*   **오늘의 특이사항**: 휴일, 방학 등 루틴에 영향을 줄 수 있는 일정을 자동으로 감지하여 알림으로 제공합니다.
*   **AI 한 줄 가이드**: "오늘은 경제 관념이 쑥쑥 자랐어요! 칭찬 한마디 어떠세요?"와 같은 AI 기반의 짧은 코칭 문구.

#### 3.1.2. 루틴 매니저 탭 (AI)
*   **AI 챗봇 기반 온보딩**: 초기 설정 시 챗봇과의 대화를 통해 자녀의 기본 루틴(기상 시간, 등원/하원 시간, 주말 루틴 여부 등)을 설문 형태로 입력받아 자동으로 루틴 카드를 생성합니다.
*   **자연어 루틴 설정**: 부모가 "우리 아이는 8시에 유치원 가고, 4시에 돌아와서 간식 먹어"와 같이 자연어로 입력하면, AI가 이를 분석하여 [08:00 등원 준비], [16:00 간식 시간] 등의 루틴 카드를 타임라인에 자동으로 배치합니다.
*   **플로팅 AI 챗봇 아이콘**: 부모 화면에 플로팅 아이콘으로 AI 챗봇을 제공하며, 클릭 시 대화창 활성화. 챗봇은 미션 설정, 알람 설정, 연간 일정 관리(평일/주말/방학/기념일 등) 키워드 리스트를 선제적으로 보여주어 대화형으로 루틴을 수정/관리합니다.
*   **미션 카드 관리**: AI가 생성한 루틴 카드를 타임라인 형태로 배치하며, 부모는 이를 확인하고 수정할 수 있습니다. 미션 카드는 온오프, 드래그 앤 드롭으로 순서 변경, 삭제/추가 기능 제공.
*   **연간 일정 관리**: 평일, 주말, 방학 기간, 특별한 날(기념일, 생일 등)을 설정하여 자녀의 하루 일과에 스페셜 팝업 노출.
*   **미션 및 보상 설정**: 각 루틴 카드에 대한 보상(Credit, EXP)을 설정하고, 미션의 종류와 난이도를 조절합니다.
*   **자녀 프로필 관리**: 자녀의 이름, 연령, 캐릭터 등을 추가하거나 편집합니다.
*   **알람 설정**: 기상 알람, 취침 알람 등 자녀의 루틴에 맞춰 알람을 설정하고, 주말/휴일에는 알람을 일시 정지하거나 해제할 수 있는 기능을 제공합니다. 알람 소리는 부모가 직접 선택하거나 업로드할 수 있습니다.

#### 3.1.3. 승인 & 큐레이션 탭
*   **구매 요청 목록**: 자녀가 마켓에서 보낸 구매 요청이 실시간으로 리스트업됩니다.
*   **승인/반려 처리**: 각 요청에 대해 상세 내역을 확인하고 승인 또는 반려 처리를 합니다. 반려 시에는 **반려 사유**를 필수로 입력합니다.
*   **미션 롤백**: 자녀가 완료한 미션 중 부모가 재확인이 필요하다고 판단하는 경우, 해당 미션을 \'미완료\' 상태로 되돌릴 수 있는 기능.
*   **부모 전용 큐레이션 커머스**: 건강 간식, 학용품, 교구 등 전문가가 큐레이션한 상품을 구매하거나, 기프티콘 형태로 선물할 수 있습니다. 부모가 \'허용된 간식 리스트\'를 미리 설정하여 자녀 마켓에 노출되는 상품을 제어할 수 있습니다. 부모는 간식 창고에서 자녀 인터페이스에 노출할 간식을 직접 선별하여 온/오프 형태로 제어할 수 있습니다.

### 3.2. 자녀용 인터페이스 (Kids UI) - 3탭 구조 (미취학 모드 MVP)

| 탭 구분 | 핵심 역할 (Concept) | 주요 구성 요소 |
| :--- | :--- | :--- |
| **1. 홈 (My Room)** | **나와 캐릭터의 공간** | 내 캐릭터, 캐릭터 꾸미기 요소, (배경으로서의) 농장/방 |
| **2. 미션 (Today)** | **오늘 할 일과 보상** | 오늘의 미션 카드, 미션 완료 애니메이션, 저금통(적립 현황), **정직 확인 카드** |
| **3. 마켓 (Shop)** | **목표 확인과 소비** | 간식/장난감 가판대, 자물쇠 해제 시각화, **딜리버리 화면** |
| **4. 스티커 (Sticker)** | **칭찬과 성취의 기록** | 곰돌이 스티커 판 (20칸), 드래그앤드롭 스티커 붙이기 |
| **5. 소셜 (Social, 확장 계획)** | **친구와 함께하는 경제 생활** | 크레딧 선물/교환, 랭킹 시스템 |

#### 3.2.1. 홈 탭 (My Room)
*   **내 캐릭터**: 화면 중앙에 사용자의 캐릭터가 크게 위치하며, EXP 레벨과 성장 상태, **현재 레벨(예: Lv.1 새싹)**을 시각적으로 보여줍니다.
*   **레벨 맵**: 현재 레벨을 중심으로 다음 레벨까지의 진행 상황을 시각적으로 보여주는 미니 맵 또는 게이지.
*   **뱃지 획득 현황**: 획득한 뱃지들을 전시하고, 미획득 뱃지는 잠금 상태로 표시하여 동기 부여.
*   **캐릭터 꾸미기**: 캐릭터 주변에 보유한 꾸미기 아이템(의상, 액세서리 등)이 배치되며, 드래그 앤 드롭 또는 클릭을 통해 즉시 착용/해제할 수 있습니다.
*   **배경**: 캐릭터의 방 또는 농장 배경을 통해 소속감을 부여하고, 향후 학령기 모드 확장 시 \'농장 꾸미기\' 등의 기반이 됩니다.

#### 3.2.2. 미션 탭 (Today)
*   **오늘의 미션 카드**: 데일리 미션(오전/오후 루틴) 블록들이 깔끔하게 배치됩니다. 각 미션은 아이콘과 간단한 시각적 요소로 표현됩니다. **미션 옆에 해당 미션이 속한 경제 개념 태그(예: #노동, #교환)를 표시합니다.**
*   **정직 확인 카드**: 미션 완료 클릭 시 캐릭터가 "정말 했어? 거짓말하면 내 마음이 아파요..."와 같은 감성 메시지를 띄워 정직한 수행을 유도하는 팝업 UI.
*   **미션 완료 애니메이션**: 미션 수행 후 블록 클릭 시, 캐릭터가 등장하여 콘페티, 꽃다발, 폭죽 등 \'그린라이트 효과\' 애니메이션과 함께 적절한 효과음이 재생되어 성취감을 극대화합니다.
*   **크레딧 적립 애니메이션**: 미션 완료 시 획득한 크레딧(동전)이 화면을 가로질러 저금통으로 날아가 적립되는 시각적 연출과 함께 동전 소리 효과음이 재생됩니다.
*   **저금통 바로가기**: 미션 탭 상단 또는 하단에 작은 저금통 아이콘을 배치하여 클릭 시 \'저금통 탭\'으로 바로 이동할 수 있도록 합니다. **현재 크레딧 숫자를 항상 크고 명확하게 화면 상단에 표시합니다.**

#### 3.2.3. 마켓 탭 (Shop)
*   **상품 가판대**: 편의점 배경의 가판대에 간식, 학용품, 장난감 등 구매 가능한 상품들이 아이콘과 함께 진열됩니다.
*   **자물쇠/활성화 시각화**: 크레딧이 부족하여 구매 불가능한 상품은 \'자물쇠\' 아이콘과 함께 비활성화(흐리게) 표시됩니다. 크레딧이 모여 구매 가능해지면 자물쇠가 사라지고 상품이 선명하게 활성화되어 아이들이 직관적으로 구매 가능 여부를 인지할 수 있도록 합니다.
*   **구매 요청**: 원하는 상품 선택 시, 상품 상세 정보(이미지, 크레딧 가격)와 함께 \'구매 요청\' 버튼이 활성화됩니다.
*   **딜리버리 화면**: 부모가 구매 요청을 승인하면, 자녀 앱에 "선물이 집으로 오고 있어요!"라는 축하 애니메이션과 배송 현황을 보여주는 UI가 노출됩니다.

#### 3.2.4. 스티커 탭 (Sticker)
*   **곰돌이 스티커 판**: 20칸으로 구성된 곰돌이 모양의 스티커 판이 제공됩니다.
*   **스티커 드래그앤드롭**: 부모가 발행한 디지털 칭찬 스티커를 자녀가 직접 드래그하여 원하는 칸에 붙일 수 있습니다.
*   **스티커 획득 애니메이션**: 새로운 스티커 획득 시 시각적/청각적 피드백 제공.

### 3.3. 자녀용 인터페이스 (Kids UI) - 학령기 모드 (확장 계획)

*   **캐릭터 외 확장**: 농장 꾸미기, 우리 마을 맵 (심즈 스타일) 활동
*   **심화 경제 활동**: 저축/투자 선택지 활성화, 만족 지연 미션 도입
*   **미니게임 확장**: 경제 습관 관련 미니게임 추가
*   **소셜 기능**: 크레딧 선물/교환, 랭킹 시스템을 통한 친구와의 상호작용. **친구 랭킹 및 전체 랭킹을 시각적으로 제공합니다.**

## 4. 서비스 아키텍처 다이어그램

### 6.3. 서비스 아키텍처 다이어그램

![COO-ANC 서비스 아키텍처](/docs/assets/SYSTEM_ARCH.png)

### 6.1. 자녀용 인터페이스 (미취학 모드 MVP) 사용자 흐름

![자녀용 인터페이스 사용자 흐름](/docs/assets/KIDS_FLOW.png)

### 6.2. 부모용 대시보드 사용자 흐름

![부모용 대시보드 사용자 흐름](/docs/assets/PARENT_FLOW.png)

## 5. 참고 자료

*   [사업계획서_등_기타_서류_양식_COOANC_쿠앙크.pdf](/home/ubuntu/upload/[붙임1]_사업계획서_등_기타_서류_양식_COOANC_쿠앵크.pdf)
*   [프레젠테이션.pptx.pdf](/home/ubuntu/upload/6_프레젠테이션.pptx.pdf)


## 6. 사용자 흐름 다이어그램

### 6.1. 자녀용 인터페이스 (미취학 모드 MVP)

```mermaid
graph TD
    subgraph "자녀용 인터페이스 (미취학 모드)"
        A[시작] --> B(홈 탭: 내 캐릭터 & 꾸미기)
        B --> C(미션 탭: 오늘의 미션)
        C --> D{미션 완료?}
        D -- 예 --> D1(정직 확인 카드 팝업: "거짓말하면 마음이 아파요...")
        D1 -- 정직하게 완료 --> E(EXP/Credit 적립 애니메이션 & 축하 효과음)
        D1 -- 정직하지 않음 --> D2(크레딧 미지급 & 캐릭터 실망)
        E --> F(저금통 탭: 크레딧 확인)
        F --> G(마켓 탭: 간식/학용품 구매 요청)
        G --> H{Credit 충분?}
        H -- 예 --> I(구매 요청 -> 부모 승인 대기)
        I --> J{부모 승인?}
        J -- 예 --> K1(딜리버리 팝업: "배송 중!")
        K1 --> K2(제품 도착 & 배송 완료 확인)
        J -- 아니오 --> L1(반려 알림: 반려 사유 확인)
        L1 --> L2(미션 재수행 또는 다른 상품 탐색)
        H -- 아니오 --> G
        C --> M(스티커 탭: 칭찬 스티커 판)
        M --> N(스티커 드래그앤드롭)
    end
```

### 6.2. 부모용 대시보드 (Parent UI)

```mermaid
    graph TD
        subgraph "부모용 대시보드"
            A[시작] --> B(홈 탭: 자녀 활동 요약 & AI 분석)
            B --> C(루틴 매니저 탭: AI 챗봇 기반 루틴 설정)
            C --> C1{AI 챗봇 대화}
            C1 -- 설문/자연어 입력 --> C2(루틴 카드 자동 생성/배치)
            C2 --> C3(미션 카드 관리: 온오프, 드래그앤드롭, 추가/삭제)
            C3 --> C4(연간 일정 관리: 평일/주말/방학/기념일)
            B --> D(승인 & 큐레이션 탭: 구매 요청 승인 & 커머스)
            D --> D1{자녀 구매 요청?}
            D1 -- 예 --> D2(구매 요청 목록 확인)
            D2 --> D3{승인?}
            D3 -- 예 --> D4_1(부모: 상품 즉시 구매)
            D4_1 --> D4_2(시스템: 자녀 앱에 '배송 중' 팝업)
            D4_2 --> D4_3(부모: 제품 수령 확인)
            D4_3 --> D4_4(시스템: 자녀 앱에 '배송 완료' 알림)
            D3 -- 아니오 --> D5_1(부모: 반려 사유 입력)
            D5_1 --> D5_2(시스템: 자녀에게 반려 알림)
            D5_2 --> D5_3(자녀: 미션 재수행 또는 다른 상품 탐색 유도)
            D1 -- 아니오 --> D6(부모 전용 큐레이션 커머스)
            D6 --> D7(간식 노출 제어: 자녀 마켓 상품 선별)
            B --> E(미션 롤백 기능)
            E --> E1{자녀 미션 완료 내역 확인}
            E1 -- 롤백 요청 --> E2(미션 상태 미완료로 변경)
            B --> F(커뮤니티 탭: 육아/경제 교육 정보 공유)
        end
    ```

## 7. 데이터베이스 스키마 및 구현 명세

COOANC 서비스의 전체 데이터베이스 스키마와 구현 명세는 Supabase를 기준으로 다음과 같이 설계되었습니다. 아래 내용은 마스터 문서의 Part 2를 기반으로 최종 반영된 버전입니다.

### 7.1. 전체 데이터베이스 스키마 (SQL)

#### 7.1.1. 확장 기능 활성화
```sql
create extension if not exists vector;
create extension if not exists "uuid-ossp";
```

#### 7.1.2. 사용자 프로필 (profiles)
```sql
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('parent', 'child')),
  name         text not null,
  avatar_url   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
```

#### 7.1.3. 가족 연결 (family_links)
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

#### 7.1.4. 자녀 경제 프로필 (child_stats)
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

#### 7.1.5. 미션 정의 (missions)
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
  concept_tag     text check (concept_tag in ('노동','교환','저축','나눔','투자','도전','학습','기여','건강','습관')),
  difficulty      text not null default 'normal' check (difficulty in ('easy','normal','hard','special')),
  repeat_type     text not null default 'daily' check (repeat_type in ('daily','weekly','monthly','event')),
  is_active       boolean default true,
  created_at      timestamptz default now()
);
```

#### 7.1.6. 미션 수행 기록 (mission_logs)
```sql
create table mission_logs (
  id           uuid primary key default uuid_generate_v4(),
  child_id     uuid not null references profiles(id) on delete cascade,
  mission_id   uuid not null references missions(id) on delete cascade,
  completed_at timestamptz default now(),
  is_verified  boolean default true, -- 정직 확인 기능
  credit_earned int not null,
  heart_earned  int not null,
  exp_earned    int not null
);
```

#### 7.1.7. 마켓 상품 (products)
```sql
create table products (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  description  text,
  image_url    text,
  price        int not null check (price > 0),
  stock        int not null default 0,
  is_digital   boolean default false,
  is_active    boolean default true,
  created_at   timestamptz default now()
);
```

#### 7.1.8. 구매 요청 (purchase_requests)
```sql
create table purchase_requests (
  id           uuid primary key default uuid_generate_v4(),
  child_id     uuid not null references profiles(id) on delete cascade,
  product_id   uuid not null references products(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'delivered')),
  request_at   timestamptz default now(),
  reviewed_at  timestamptz,
  reject_reason text, -- 반려 사유
  delivery_status text -- 배송 상태
);
```

#### 7.1.9. 목표 저금통 (saving_goals)
```sql
create table saving_goals (
  id             uuid primary key default uuid_generate_v4(),
  child_id       uuid not null references profiles(id) on delete cascade,
  goal_name      text not null,
  target_amount  int not null,
  current_amount int not null default 0,
  is_active      boolean default true,
  achieved_at    timestamptz,
  created_at     timestamptz default now()
);
```

#### 7.1.10. 뱃지 (badges & child_badges)
```sql
create table badges (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  description text,
  icon_url    text,
  category    text not null check (category in ('level', 'special'))
);

create table child_badges (
  id         uuid primary key default uuid_generate_v4(),
  child_id   uuid not null references profiles(id) on delete cascade,
  badge_id   uuid not null references badges(id) on delete cascade,
  earned_at  timestamptz default now(),
  unique (child_id, badge_id)
);
```

#### 7.1.11. RAG 지식베이스 (curriculum_chunks)
```sql
create table curriculum_chunks (
  id           uuid primary key default uuid_generate_v4(),
  chunk_id     text not null unique, -- e.g., 'LEVEL-001'
  chunk_type   text not null, -- e.g., 'level_definition'
  content      text not null,
  metadata     jsonb,
  embedding    vector(1536), -- OpenAI's text-embedding-ada-002
  created_at   timestamptz default now()
);
```

### 7.2. 개발 가드레일 및 보안 정책

개발 시 다음 규칙을 반드시 준수하여 데이터 정합성과 보안을 유지해야 합니다.

*   **크레딧 처리**: 크레딧의 증감은 프론트엔드에서 직접 조작하는 것을 금지하며, 반드시 데이터베이스 트리거(Trigger)를 통해서만 처리되어야 합니다.
*   **지식베이스 접근 제어**: `curriculum_chunks` 테이블은 민감한 커리큘럼 정보를 포함하므로, `service_role`만 접근 가능하도록 RLS(Row-Level Security) 정책을 설정해야 합니다.
*   **EQ 지수 계산**: 경제 EQ 지수 계산은 반드시 `recalculate_eq()` 함수를 경유하여 일관된 로직으로 처리되어야 합니다.
*   **실시간 구독 제한**: 실시간(Realtime) 구독은 `mission_logs`, `purchase_requests`, `child_stats` 3개 테이블로 제한하여 불필요한 부하를 방지합니다.

## 8. 경제 교육 커리큘럼 상세

COO-ANC의 핵심인 단계별 경제 교육 커리큘럼은 AI 에이전트의 RAG(Retrieval-Augmented Generation) 지식 베이스로 활용되며, 자녀의 개념 숙달도에 따라 레벨이 자동으로 승급됩니다.

### 8.1. 레벨 구조 및 핵심 개념

| 레벨 | 이름 | 핵심 개념 | 권장 연령 | 승급 자동 판단 기준 (공통) |
|------|------|-----------|-----------|---------------------------------|
| Lv.0 | 씨앗 | 행동-보상 연결 | 3~4세 | 미션 누적 달성률 ≥ 80%, EQ 개념 지수 해당 레벨 기준치 이상, 유지 기간 ≥ 14일 |
| Lv.1 | 새싹 | 교환의 개념 | 4~5세 | 미션 누적 달성률 ≥ 80%, EQ 개념 지수 해당 레벨 기준치 이상, 유지 기간 ≥ 14일 |
| Lv.2 | 교환사 | 실물 화폐 교환 | 5~6세 | 미션 누적 달성률 ≥ 80%, EQ 개념 지수 해당 레벨 기준치 이상, 유지 기간 ≥ 14일 |
| Lv.3 | 저축왕 | 저축과 목표 설정 | 6~7세 | 미션 누적 달성률 ≥ 80%, EQ 개념 지수 해당 레벨 기준치 이상, 유지 기간 ≥ 14일 |
| Lv.4 | 나눔이 | 증여와 나눔 | 7~8세 | 미션 누적 달성률 ≥ 80%, EQ 개념 지수 해당 레벨 기준치 이상, 유지 기간 ≥ 14일 |
| Lv.5 | 투자가 | 투자와 리스크 | 8~10세 | 미션 누적 달성률 ≥ 80%, EQ 개념 지수 해당 레벨 기준치 이상, 유지 기간 ≥ 14일 |

### 8.2. 레벨별 상세 목표 및 UX

#### 8.2.1. Lv.0 씨앗 단계 — 행동-보상 연결
*   **학습 목표**: 미션을 수행하면 크레딧이 생긴다는 인과관계 인식, 숫자가 올라가는 시각적 경험, 앱과 캐릭터에 흥미 형성.
*   **핵심 경제 개념**: 노동의 개념, 보상의 개념.
*   **경제 EQ 목표 수치 (승급 기준)**: 만족 지연 지수: 기준 없음 (즉각 보상), 루틴 완주율: ≥ 50%, 소비 vs 저축 비중: 측정 안 함.
*   **앱 UX 핵심 포인트**: 미션 완료 시 크레딧 숫자 카운팅 애니메이션, 캐릭터 칭찬 멘트, 현재 크레딧 숫자를 항상 크고 명확하게 화면 상단 표시.
*   **승급 자동 판단 조건**: 미션 누적 완료 횟수 ≥ 10회, 루틴 완주율 ≥ 50% (최근 14일 기준), 자동 승급 가능 (부모 알림 발송 후 72시간 내 거부 없으면 자동 승급).

#### 8.2.2. Lv.1 새싹 단계 — 교환의 개념
*   **학습 목표**: 크레딧이 원하는 것과 교환된다는 개념 인식, 크레딧 수량 비교, 갖고 싶은 것을 위해 잠깐 기다리는 경험.
*   **핵심 경제 개념**: 화폐의 기능, 가격 개념, 수량 비교.
*   **경제 EQ 목표 수치 (승급 기준)**: 만족 지연 지수: ≥ 30점, 루틴 완주율: ≥ 60%, 소비 vs 저축 비중: 측정 시작.
*   **인앱 스토어 (Lv.1 전용 디지털 아이템)**: 캐릭터 코스튬 아이템, 스티커 팩, 배경화면 테마, 유튜브 30분 이용권 (부모 사전 설정 필요), 디저트 선택권 (부모 사전 설정 필요).
*   **핵심 UX**: 부족분 시각화 (상품 가격과 현재 크레딧을 나란히 막대그래프로 비교, "10개 더 모으면 살 수 있어!" 자동 계산 표시).
*   **승급 자동 판단 조건**: 인앱 스토어 구매 ≥ 3회, 루틴 완주율 ≥ 60% (최근 14일), 만족 지연 지수 ≥ 30점.

#### 8.2.3. Lv.2 교환사 단계 — 실물 화폐 교환
*   **학습 목표**: 사이버 크레딧이 진짜 물건으로 교환된다는 경험, 구매 요청 → 대기 → 수령의 과정 체험, 배송을 기다리는 지연 만족 훈련.
*   **핵심 경제 개념**: 실물 화폐 교환, 시장의 개념, 유통의 개념.
*   **실물 교환 플로우**: 아이가 앱 마켓에서 상품 선택 + 구매 요청 버튼 탭 → 부모 앱에 알림 발송 → 부모 승인/거절 → 부모가 실제 구매 또는 준비 → 앱에서 "준비 중 → 배송 중 → 도착!" 상태 업데이트 → 아이가 수령 확인 버튼 → 캐릭터 축하 이벤트.
*   **부모 자동화 설정 옵션**: 월 예산 한도 설정 시 한도 내 자동 승인 가능, 특정 카테고리 자동 승인 설정 가능.
*   **경제 EQ 목표 수치 (승급 기준)**: 만족 지연 지수: ≥ 50점, 루틴 완주율: ≥ 65%, 소비 vs 저축 비중: 소비 비중 ≤ 90%.
*   **승급 자동 판단 조건**: 실물 교환 완료 ≥ 2회, 만족 지연 지수 ≥ 50점, 루틴 완주율 ≥ 65% (최근 14일).

#### 8.2.4. Lv.3 저축왕 단계 — 저축과 목표 설정
*   **학습 목표**: 지금 쓰지 않고 모으면 더 큰 가치를 얻는다는 개념, 목표를 설정하고 달성하는 경험, 작은 것 vs 큰 것 선택 경험 (기회비용 입문).
*   **핵심 경제 개념**: 저축의 개념, 목표 지향성, 기회비용.
*   **핵심 기능**: 목표 저금통 (아이가 원하는 상품 선택 → 목표 저금통 생성, 저금통 채워지는 애니메이션, 달성 예상 날짜 자동 계산, 중간에 다른 것 구매 시 목표 달성일이 늘어나는 것 시각화).
*   **기회비용 UX**: 저금통 외 구매 시도 시: "지금 사면 {목표상품} 달성일이 {N}일 늦어져. 그래도 살까?".
*   **경제 EQ 목표 수치 (승급 기준)**: 만족 지연 지수: ≥ 70점, 루틴 완주율: ≥ 70%, 소비 vs 저축 비중: 저축 비중 ≥ 30%.
*   **승급 자동 판단 조건**: 목표 저금통 달성 ≥ 1회, 만족 지연 지수 ≥ 70점, 저축 비중 ≥ 30% (최근 30일).

#### 8.2.5. Lv.4 나눔이 단계 — 증여와 나눔
*   **학습 목표**: 내 크레딧을 타인에게 줄 수 있다는 개념, 주는 사람도 기쁘다는 경험 (공감 경제), 기부의 개념 입문.
*   **핵심 경제 개념**: 증여의 개념, 선물 경제, 기부의 개념.
*   **핵심 기능**: 선물하기 (친구/가족 COOANC 계정으로 크레딧 전송, 생일 알림 자동 감지 → 선물 유도, 선물 카드 직접 꾸미기).
*   **핵심 기능**: 기부하기 (파트너 NGO 연동, 기부 결과 시각화, 기부 시 특별 뱃지 지급).
*   **승급 자동 판단 조건**: 선물하기 ≥ 1회, 기부하기 ≥ 1회, 루틴 완주율 ≥ 70% (최근 14일).

#### 8.2.6. Lv.5 투자가 단계 — 투자와 리스크
*   **학습 목표**: 크레딧이 불어나는 경험 (복리), 손실 가능성 인식 (리스크), 장기적 관점의 경제 활동.
*   **핵심 경제 개념**: 투자의 개념, 복리의 개념, 리스크와 수익의 관계.
*   **핵심 기능**: 가상 투자 (가상 주식/펀드 투자, 투자 결과 시뮬레이션, 투자 일기 작성).
*   **리스크 교육 UX**: 투자 손실 시: "크레딧이 줄어들었어. 다음엔 더 신중하게 투자해 볼까?".
*   **경제 EQ 목표 수치 (승급 기준)**: 만족 지연 지수: ≥ 80점, 루틴 완주율: ≥ 75%, 소비 vs 저축 vs 투자 비중: 투자 비중 ≥ 10%.
*   **승급 자동 판단 조건**: 가상 투자 경험 ≥ 3회, 투자 수익률 ≥ 0% (누적), 루틴 완주율 ≥ 75% (최근 14일).
