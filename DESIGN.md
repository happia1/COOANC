---
name: COOANC 소개 사이트
description: 아이는 스스로, 부모는 한결 편안하게. 작은 정원의 성장 일지처럼 자라는 습관을 보여주는 쿠앵크 소개 사이트.
colors:
  brand-indigo: "#454fc3"
  brand-indigo-deep: "#2D38BE"
  brand-tint: "#EAECFA"
  ink: "#1F2937"
  ink-navy: "#293446"
  ink-soft: "#536176"
  ink-muted: "#647086"
  ink-faint: "#8B95A1"
  cream-page: "#fffefb"
  white: "#FFFFFF"
  mist: "#F4F8FB"
  sky-wash: "#eef5f6"
  line: "#E6EEF3"
  lavender-edge: "#d6d8ea"
  lavender-shadow: "#d9dbea"
  line-strong: "#ccd2e5"
  sand: "#f7f0e4"
  sand-line: "#d7cdbb"
  sand-ink: "#4d4a45"
  gold-ink: "#5f4a1e"
  pm-amber: "#7a5400"
  pm-edge: "#ecd9a8"
  popup-violet: "#6a5af0"
  popup-blue: "#2f6fc4"
  popup-ink: "#111827"
  popup-slate: "#4b5563"
  peach-hero: "#f9ecde"
  oat-scene: "#f7f1e9"
  sun: "#FFC94D"
  sun-tint: "#FFF6E2"
  mint: "#2FBE86"
  mint-tint: "#E9FAF2"
typography:
  display:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(34px, 4.3vw, 56px)"
    fontWeight: 700
    lineHeight: 1.28
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(28px, 3.4vw, 42px)"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.85
  label:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.4
  brand-voice:
    fontFamily: "Jua, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.2
rounded:
  sm: "10px"
  md: "12px"
  card: "16px"
  tile: "18px"
  lg: "20px"
  popup: "24px"
  panel: "28px"
  device: "32px"
  pill: "100px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "20px"
  lg: "28px"
  section-focal: "96px"
  section: "72px"
  section-tail: "56px"
  section-focal-mobile: "60px"
  section-mobile: "52px"
  section-tail-mobile: "44px"
components:
  button-primary:
    backgroundColor: "{colors.brand-indigo}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "14px 22px"
  button-primary-hover:
    backgroundColor: "{colors.brand-indigo-deep}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "14px 22px"
  tab-segment:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "9px 20px"
  tab-segment-active:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
  core-card:
    backgroundColor: "{colors.cream-page}"
    textColor: "{colors.ink-navy}"
    rounded: "22px"
    padding: "24px"
  demo-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "14px 8px 12px"
  honesty-dialog:
    backgroundColor: "{colors.white}"
    textColor: "{colors.popup-ink}"
    rounded: "{rounded.popup}"
    padding: "32px 24px 24px"
  page-head:
    backgroundColor: "{colors.sky-wash}"
    textColor: "{colors.ink}"
    padding: "56px 0 52px"
---

# Design System: COOANC 소개 사이트

## Overview

**Creative North Star: "작은 정원의 성장 일지"**

이 사이트는 아이의 하루가 한 칸씩 자라는 일지처럼 읽힙니다. 따뜻한 크림 바탕 위에 로고의 인디고가 단 하나의 행동 색으로 서고, 노랑과 민트는 보상과 성장의 신호로만 쓰입니다. 정보를 쏟아내기보다 앱 화면, 화분, 스티커판, 저금통 같은 실제 소재가 주인공이 되고, 문장은 잔소리 대신 응원의 말투(~해요 체)를 씁니다.

분위기는 **생동감 있는 게임 같은** 쪽으로 기웁니다. 카드를 아래로 누르는 하드 섀도, 탭에 반응하는 미션 체험 데모, 반짝이는 펄스 같은 마이크로 인터랙션이 그 증거입니다. 다만 색의 폭발이 아니라 구조(일정한 여백, 긴 줄간격, 조용한 파스텔 바닥)로 안정감을 유지합니다. 부모가 육아 중 모바일로 읽는 사이트이므로 생동감은 반응과 디테일에서 오고 배경에서는 오지 않습니다.

확인된 시각적 거부: **남발되는 유아 색상**(원색이 폭발하는 유치원식 인상)과 **일반적인 SaaS 랜딩**(그라데이션 히어로와 똑같은 카드 그리드 템플릿).

**Key Characteristics:**
- 크림(#fffefb) 바탕 + 인디고 단일 행동 색, 노랑과 민트는 보상 신호 전용
- 실제 앱 캡처와 캐릭터 일러스트가 시각의 중심
- 하드 섀도(0 6px 0)로 누르고 싶은 카드를 만드는 게임적 촉감
- 12px 모서리의 버튼, 20~28px의 큰 패널, 100px 알약은 칩과 탭 전용
- 넓은 줄간격(1.85)과 `word-break: keep-all`로 한글을 편안하게 읽히게 함

## Colors

크림과 파스텔 바닥 위에 인디고 하나가 방향을 알려주고, 따뜻한 중성색이 분위기를 잡는 팔레트입니다.

### Primary
- **쿠앵크 인디고** (#454fc3): 모든 페이지의 주 행동 색. CTA 버튼, 링크, 강조 문구, 포커스 링에 씁니다. 로고의 파랑·보라에서 왔고 `style.css`의 `--brand` 토큰과 같은 값입니다(흰 글자 대비 6.65:1).
- **인디고 딥** (#2D38BE): 호버, 눌림, 칩 위 글자 색.
- **인디고 틴트** (#EAECFA): 아이브로 칩과 선택된 단계의 바탕.

### Secondary
- **햇살 노랑** (#FFC94D, 틴트 #FFF6E2): 크레딧과 보상, 성장 순간의 강조.
- **새싹 민트** (#2FBE86, 틴트 #E9FAF2): "준비 중", 정직·완료 같은 긍정 신호.

### Neutral
- **크림 페이지** (#fffefb): 홈, 서비스 소개, 가이드의 기본 바탕. 순백보다 따뜻합니다.
- **하늘 안개** (#eef5f6): 홈 히어로 바탕.
- **복숭아 장면** (#f9ecde)과 **귀리 장면** (#f7f1e9): 일상 장면 일러스트를 담는 따뜻한 바닥.
- **샌드** (#f7f0e4, 선 #d7cdbb, 글자 #4d4a45 / #5f4a1e): 금융 역량 근거 섹션 전용의 따뜻한 바닥. 황금 저금통과 어울립니다.
- **라인 스트롱** (#ccd2e5): 정직 확인 섹션 같은 연보라 바닥 위의 구분선.
- **잉크** (#1F2937)와 **네이비 잉크** (#293446): 제목, 본문.
- **슬레이트** (#536176 / #647086 / #8B95A1): 보조 문장, 설명, 비활성.
- **라인** (#E6EEF3)과 **라벤더 엣지** (#d6d8ea): 테두리. 라벤더 엣지는 게임 카드의 테두리 전용.

### 팝업 색
- **팝업 바이올렛** (#6a5af0)과 **팝업 블루** (#2f6fc4): 앱의 정직 확인 팝업 버튼을 옮긴 색. 앱 원색보다 살짝 어둡게 해 흰 글자 대비 4.5:1 이상을 맞췄습니다. 팝업 안 글자는 #111827과 #4b5563입니다.
- **오후 앰버** (#7a5400, 테두리 #ecd9a8): 오후 미션 배지와 카드.

### Named Rules
**The One Voice Rule.** 인디고는 행동(누를 것, 갈 곳)에만 쓴다. 장식에 쓰지 않는다. 노랑과 민트는 보상과 상태에만 쓴다.
**The Warm Floor Rule.** 큰 바탕은 크림과 파스텔 중성색이다. 원색 면적을 키우지 않는다.

## Typography

**Display/Body Font:** Pretendard (fallback: -apple-system, BlinkMacSystemFont, sans-serif)
**Brand Voice Font:** Jua (Google Fonts), 로고 옆 워드마크와 일부 포인트 문구

**Character:** 단정한 산세리프가 정보를 맡고, 둥근 손글씨 Jua가 쿠앵크 특유의 친근함을 맡습니다. Pretendard Variable은 jsDelivr의 동적 서브셋 CSS로 로드합니다(모든 페이지의 `<head>`).

### Hierarchy
모든 크기는 rem이며 `style.css`의 `:root` 토큰을 씁니다. 사용자의 글꼴 크기 설정과 브라우저 확대를 그대로 따릅니다(150%, 200%에서 가로 넘침 없음 확인). 모바일(390px) 기준 값은 괄호 안입니다.
- **Display** (`--fs-display`, 700, clamp(1.75rem, 1.15rem + 2.9vw, 2.625rem), 1.25, -0.03em) (30px): 홈 히어로 두 문장. 각 문장은 `.hl` 블록으로 나눠 균형 줄바꿈합니다.
- **Headline 1** (`--fs-h1`, 700, clamp(1.75rem, 1.3rem + 2.2vw, 2.75rem), 1.3, -0.03em) (29px): 각 탭의 페이지 헤더 제목과 홈의 초점 섹션(미션 체험) 제목.
- **Headline 2** (`--fs-h2`, 700, clamp(1.5rem, 1.25rem + 1.3vw, 2.25rem), 1.35, -0.03em) (25px): 섹션 제목.
- **Title** (`--fs-h3`, 700, 1.25rem, 1.45) (20px): 카드 제목. 목록형 소제목은 1.125rem(18px).
- **Lead** (`--fs-lead`, 1.0625rem, 1.75) (17px): 섹션 도입 문장.
- **Body** (`--fs-body`, 400, 1rem, 1.75) (16px): 본문. 한글은 `word-break: keep-all`, 읽기 길이는 모바일에서 한 줄 약 20자, 데스크톱에서 `max-width: 52~56ch`.
- **Small** (`--fs-small`, 0.875rem) (14px): 캡션, 노트, 폼 안내, 근거 설명.
- **Label** (`--fs-label`, 700, 0.8125rem) (13px): 칩, 배지, 탭. 이보다 작은 글자는 앱 화면 목업(장식) 안에서만 씁니다.

제목은 `text-wrap: balance`, 본문은 `text-wrap: pretty`입니다. 폴백 스택은 Pretendard Variable, Pretendard, Apple SD Gothic Neo, Noto Sans KR, Malgun Gothic 순입니다.

### Named Rules
**The Role Scale Rule.** 글자 크기는 위 토큰 역할에서만 고른다. 새 크기가 필요하면 페이지에서 px를 쓰지 말고 역할을 먼저 정한다.
**The Keep-All Rule.** 한글 줄바꿈은 어절 단위(`keep-all`)로 하고 제목은 `text-wrap: balance`를 쓴다.
**The Jua Accent Rule.** Jua는 워드마크와 한두 줄의 포인트에만 쓴다. 본문과 정보 문장에 쓰지 않는다.

## Layout

최대 너비 1080~1160px의 중앙 컨테이너에 좌우 패딩 22px(모바일)~28px(데스크톱). 섹션 간격은 역할에 따라 세 단계입니다. 초점(홈의 미션 체험) 96px, 일반 72px, 꼬리(FAQ, CTA) 56px이고 모바일에서는 각각 60/52/44px입니다. 히어로는 상하 48px로 낮게 잡아 데스크톱 첫 화면에 체험 기기가 걸치게 합니다. 제목은 초점 섹션만 44px, 나머지는 36px입니다. 히어로는 2열(텍스트 1.15 : 이미지 1)이며 640px 이하에서 1열로 접힙니다. 내비게이션은 860px에서 가로 메뉴로 바뀝니다. 터치 영역은 44px 이상(`min-height: 44~48px`)을 지킵니다. 소개 페이지마다 `--maxw`를 달리해(홈 1120, 서비스 소개 1160) 약간의 리듬 차이를 줍니다.

## Elevation & Depth

두 가지 깊이 언어가 공존합니다. 하드 섀도는 의도된 정체성입니다(감지기의 hard-offset-shadow 경고는 이 의도로 인한 것).
- **부드러운 퍼짐**: 폰 프레임과 떠 있는 요소 (`0 22px 42px -20px rgba(20,30,45,.3)`, `0 6px 24px #29344612`). 주변광처럼 조용합니다.
- **하드 섀도**: 게임 카드를 아래로 누르는 촉감 (`0 6px 0 #d9dbea`, 활성 시 `0 6px 0 #9ea5e5`). 누를 수 있는 카드의 시그니처입니다.

### Named Rules
**The Press-Down Rule.** 하드 섀도는 누를 수 있는 카드(미션 체험 카드, 코어 기능, 미래 기능)에만 쓴다. 정보용 카드는 1px 라인으로 충분하다.

## Shapes

형태 언어는 둥글고 단단합니다. 버튼은 12px, 카드는 16~24px, 큰 패널과 히어로 이미지는 28px, 칩과 탭은 100px 알약, 폰 프레임은 26px에 7px 두께의 어두운 테두리입니다. 버튼은 모든 페이지에서 12px로 통일했습니다.

## Components

### Buttons
- **Shape:** 12px 모서리, 높이 48px. 모든 페이지 공통.
- **Primary:** 인디고(#454fc3) 바탕에 흰 글자, 그림자 없음. 호버는 인디고 딥.
- **Secondary:** 흰 바탕, 1px 라인 테두리, 잉크 글자.
- **Hover / Focus:** 포커스는 3px 인디고 아웃라인에 4px 오프셋. 눌림은 `scale(.97)`.

### Tabs (세그먼트)
- **Style:** 미스트 트랙 안에 알약형 탭. 선택된 탭만 흰 알약이 떠 보이며 1px 그림자.
- 대분류(알약)와 소분류 칩(각진 작은 사각형)을 분리해 위계를 만듭니다.

### Cards / Containers
- **Core card:** 22px 모서리, 2px 라벤더 엣지 테두리, 크림 바탕, 하드 섀도. 선택 시 테두리가 인디고(#5964d4)로.
- **Info card:** 1px 라인 테두리, 20px 모서리, 그림자 없음.
- **Scene card:** 귀리색(#f7f1e9) 바탕 위 100px 일러스트.

### Chips
- **준비 중 배지:** 민트 틴트 바탕, 짙은 초록 글자.
- **근거 수준 배지:** 샌드 위 크림 알약(#fffaf2), 글자 #5f4a1e, 13px 700.

### Navigation
- 76px 높이의 크림 바탕, 하단 라인. 링크 호버/활성은 하단 2px 인디고. 모바일은 햄버거(44px)와 펼침 메뉴. 건너뛰기 링크 제공.

### Phone Frame (시그니처)
- 앱 캡처를 감싸는 7px 잉크 테두리의 26px 둥근 프레임과 큰 부드러운 그림자. 사이트의 가장 강한 증거 요소.

### Mission Demo (시그니처)
- 홈 `#try`는 서비스 소개의 "오늘의 미션" 태블릿 화면(어두운 프레임 8px, 3:4 장면, 레벨·크레딧 카드, 캐릭터, 저금통, 화분)을 그대로 옮겼습니다. 모바일에서도 전폭 태블릿 한 대로 보이고, 화면 속에 또 다른 폰 모양을 만들지 않습니다.
- 오늘의 미션 카드는 한 줄 가로 슬라이드입니다(스와이프, 좌우 화살표 44px). 세 번째 카드가 걸쳐 보여 옆으로 더 있음을 알립니다. 실제 앱과 같습니다.
- 카드 색은 앱 그대로: 오전 미션은 연한 분홍(`#fff1f2`, 테두리 `#fecdd3`), 오후 미션은 연한 파랑(`#eff6ff`, 테두리 `#bfdbfe`)이고, 둘 사이에 세로 구분선이 있습니다. 보상은 회색 알약입니다.
- 완료한 카드는 앱처럼 사라지고 남은 카드가 앞으로 당겨집니다.

### Honesty Dialog (시그니처)
- 앱의 정직 확인 팝업을 그대로 옮긴 네이티브 `<dialog>`. "거짓말은 안 돼!"(오전에 오후 미션)와 "정말 한 거 맞아?"(3초 안에 5개 연속)를 수달 캐릭터(`dont.png`, `dont_lie.png`)와 함께 보여줍니다. 24px 모서리, 320px 폭, 뒤 배경 60% 어둡게. 정직 확인 섹션의 버튼으로도 열 수 있습니다.

### Header (홈 히어로와 모든 탭의 Page Head)
- 장면 이미지가 헤더 영역을 패딩 없이 가득 채우는 배경입니다. 카드, 둥근 모서리, 여백 있는 액자 형태는 쓰지 않습니다.
- 데스크톱(720px 이상): 이미지는 영역 높이에 맞춰 오른쪽에 붙고(원본 비율, 잘림 없음), 왼쪽 가장자리는 마스크 그라데이션으로 헤더 배경색(`--head-rgb`)에 녹아듭니다. 글자는 왼쪽 52~54% 안에 두고, 겹치는 좁은 화면을 위해 왼쪽에서 오른쪽으로 옅어지는 오버레이를 한 겹 더 둡니다.
- 모바일: 글자가 위, 이미지가 아래에 전폭으로 붙고, 이미지 윗부분이 위쪽 배경색으로 흐려지며 글자 쪽과 이어집니다.
- 배경색은 이미지 가장자리 색에서 뽑습니다: 홈 `236 243 244`, 서비스 소개 `253 239 224`, 사용가이드 `252 236 222`, 문의와 이야기 `232 241 244`.
- 높이: 홈 540px, 내부 탭 360~380px(데스크톱).

## Do's and Don'ts

### Do:
- **Do** 앱의 실제 화면과 캐릭터 일러스트를 시각의 중심에 둔다.
- **Do** 인디고는 눌러야 할 곳에만 쓰고, 노랑과 민트는 보상과 상태 신호로만 쓴다.
- **Do** 한글에 `keep-all`과 넉넉한 줄간격(1.85)을 쓴다.
- **Do** 모든 터치 대상은 44px 이상으로 하고 `prefers-reduced-motion`을 존중한다.
- **Do** 누르는 카드에만 하드 섀도를 쓴다.
- **Do** 앱이 못 하는 일(수행 확인, 자산 보장)은 13px 이상, 대비 4.5:1 이상으로 눈에 보이게 쓴다.
- **Do** 연구를 인용할 때 근거 수준(관찰연구, 메타분석, 문헌 종합)을 함께 적는다.

### Don't:
- **Don't** 원색이 폭발하는 유아 색상으로 가지 않는다. 바탕은 크림과 파스텔 중성색이다.
- **Don't** 일반적인 SaaS 랜딩(그라데이션 히어로, 똑같은 3열 카드, 추상 아이콘 나열)을 쓰지 않는다.
- **Don't** 근거 없는 수치, 후기, 효과 보장 문구를 디자인 요소(배지, 카운터)로 만들지 않는다.
- **Don't** 제목 위에 라벨 칩(아이브로)이나 섹션 번호를 얹지 않는다.
- **Don't** 이모지를 아이콘 대신 쓰지 않는다. 일러스트나 SVG를 쓴다.
- **Don't** 연구가 "증명"한다고 쓰지 않는다. 연관과 시사의 수준으로만 쓴다.
