---
name: COOANC 소개 사이트
description: 아이는 스스로, 부모는 한결 편안하게. 작은 정원의 성장 일지처럼 자라는 습관을 보여주는 쿠앵크 소개 사이트.
colors:
  brand-indigo: "#454fc3"
  brand-indigo-light: "#515CD6"
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
  peach-hero: "#f9ecde"
  oat-scene: "#f7f1e9"
  sun: "#FFC94D"
  sun-tint: "#FFF6E2"
  mint: "#2FBE86"
  mint-tint: "#E9FAF2"
typography:
  display:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(34px, 4.3vw, 56px)"
    fontWeight: 700
    lineHeight: 1.28
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(28px, 3.4vw, 42px)"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.85
  label:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
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
  lg: "20px"
  xl: "24px"
  panel: "28px"
  pill: "100px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "20px"
  lg: "28px"
  section: "80px"
  section-mobile: "64px"
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
  eyebrow-chip:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-indigo-deep}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
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
- **쿠앵크 인디고** (#454fc3): 홈 페이지의 주 행동 색. CTA 버튼, 링크, 강조 문구, 포커스 링에 씁니다. 로고의 파랑·보라에서 왔습니다.
- **인디고 라이트** (#515CD6): `style.css`의 `--brand` 토큰. 홈에서는 #454fc3으로 덮어쓰이는 값이라 정리 대상입니다.
- **인디고 딥** (#2D38BE): 호버, 눌림, 칩 위 글자 색.
- **인디고 틴트** (#EAECFA): 아이브로 칩과 선택된 단계의 바탕.

### Secondary
- **햇살 노랑** (#FFC94D, 틴트 #FFF6E2): 크레딧과 보상, 성장 순간의 강조.
- **새싹 민트** (#2FBE86, 틴트 #E9FAF2): "준비 중", 정직·완료 같은 긍정 신호.

### Neutral
- **크림 페이지** (#fffefb): 홈, 서비스 소개, 가이드의 기본 바탕. 순백보다 따뜻합니다.
- **하늘 안개** (#eef5f6): 홈 히어로 바탕.
- **복숭아 장면** (#f9ecde)과 **귀리 장면** (#f7f1e9): 일상 장면 일러스트를 담는 따뜻한 바닥.
- **잉크** (#1F2937)와 **네이비 잉크** (#293446): 제목, 본문.
- **슬레이트** (#536176 / #647086 / #8B95A1): 보조 문장, 설명, 비활성.
- **라인** (#E6EEF3)과 **라벤더 엣지** (#d6d8ea): 테두리. 라벤더 엣지는 게임 카드의 테두리 전용.

### Named Rules
**The One Voice Rule.** 인디고는 행동(누를 것, 갈 곳)에만 쓴다. 장식에 쓰지 않는다. 노랑과 민트는 보상과 상태에만 쓴다.
**The Warm Floor Rule.** 큰 바탕은 크림과 파스텔 중성색이다. 원색 면적을 키우지 않는다.

## Typography

**Display/Body Font:** Pretendard (fallback: -apple-system, BlinkMacSystemFont, sans-serif)
**Brand Voice Font:** Jua (Google Fonts), 로고 옆 워드마크와 일부 포인트 문구

**Character:** 단정한 산세리프가 정보를 맡고, 둥근 손글씨 Jua가 쿠앵크 특유의 친근함을 맡습니다. **주의:** Pretendard는 `font-family`에만 지정되어 있고 로드하는 코드(@font-face, link)가 없어, 설치되지 않은 기기에서는 시스템 폰트로 대체됩니다.

### Hierarchy
- **Display** (700, clamp(34px, 4.3vw, 56px), 1.28, -0.045em): 홈 히어로 한 줄.
- **Headline** (700, clamp(28px, 3.4vw, 42px), 1.35, -0.045em): 섹션 제목.
- **Title** (700, 20px, -0.025em): 카드 제목.
- **Body** (400, 17px 리드 / 15~16px 본문, 줄간격 1.85): 설명. 한글은 `word-break: keep-all`.
- **Label** (700, 13px): 아이브로, 탭, 칩.

### Named Rules
**The Keep-All Rule.** 한글 줄바꿈은 어절 단위(`keep-all`)로 하고 제목은 `text-wrap: balance`를 쓴다.
**The Jua Accent Rule.** Jua는 워드마크와 한두 줄의 포인트에만 쓴다. 본문과 정보 문장에 쓰지 않는다.

## Layout

최대 너비 1080~1160px의 중앙 컨테이너에 좌우 패딩 22px(모바일)~28px(데스크톱). 섹션은 위아래 64px(모바일)~80px. 히어로는 2열(텍스트 1.15 : 이미지 1)이며 640px 이하에서 1열로 접힙니다. 내비게이션은 860px에서 가로 메뉴로 바뀝니다. 터치 영역은 44px 이상(`min-height: 44~48px`)을 지킵니다. 소개 페이지마다 `--maxw`를 달리해(홈 1120, 서비스 소개 1160) 약간의 리듬 차이를 줍니다.

## Elevation & Depth

두 가지 깊이 언어가 공존합니다.
- **부드러운 퍼짐**: 폰 프레임과 떠 있는 요소 (`0 22px 42px -20px rgba(20,30,45,.3)`, `0 6px 24px #29344612`). 주변광처럼 조용합니다.
- **하드 섀도**: 게임 카드를 아래로 누르는 촉감 (`0 6px 0 #d9dbea`, 활성 시 `0 6px 0 #9ea5e5`). 누를 수 있는 카드의 시그니처입니다.

### Named Rules
**The Press-Down Rule.** 하드 섀도는 누를 수 있는 카드(코어 기능, 미래 기능)에만 쓴다. 정보용 카드는 1px 라인으로 충분하다.

## Shapes

형태 언어는 둥글고 단단합니다. 버튼은 12px(홈), 카드는 20~24px, 큰 패널과 히어로 이미지는 28px, 칩과 탭은 100px 알약, 폰 프레임은 26px에 7px 두께의 어두운 테두리입니다. **주의:** 홈은 버튼을 12px로 덮어쓰지만 `style.css`의 기본은 100px 알약이라 페이지마다 버튼 모양이 다릅니다.

## Components

### Buttons
- **Shape:** 12px 모서리, 높이 48px (홈 기준). 기본 스타일시트는 100px 알약.
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
- **Eyebrow:** 인디고 틴트 바탕, 인디고 딥 글자, 알약, 13px 700.
- **준비 중 배지:** 민트 틴트 바탕, 짙은 초록 글자.

### Navigation
- 76px 높이의 크림 바탕, 하단 라인. 링크 호버/활성은 하단 2px 인디고. 모바일은 햄버거(44px)와 펼침 메뉴. 건너뛰기 링크 제공.

### Phone Frame (시그니처)
- 앱 캡처를 감싸는 7px 잉크 테두리의 26px 둥근 프레임과 큰 부드러운 그림자. 사이트의 가장 강한 증거 요소.

### Mission Demo (시그니처)
- 사용자가 미션 카드를 직접 눌러 크레딧과 하트가 오르는 체험 데모. 반짝임과 사라짐 애니메이션, 탭 힌트 펄스.

## Do's and Don'ts

### Do:
- **Do** 앱의 실제 화면과 캐릭터 일러스트를 시각의 중심에 둔다.
- **Do** 인디고는 눌러야 할 곳에만 쓰고, 노랑과 민트는 보상과 상태 신호로만 쓴다.
- **Do** 한글에 `keep-all`과 넉넉한 줄간격(1.85)을 쓴다.
- **Do** 모든 터치 대상은 44px 이상으로 하고 `prefers-reduced-motion`을 존중한다.
- **Do** 누르는 카드에만 하드 섀도를 쓴다.

### Don't:
- **Don't** 원색이 폭발하는 유아 색상으로 가지 않는다. 바탕은 크림과 파스텔 중성색이다.
- **Don't** 일반적인 SaaS 랜딩(그라데이션 히어로, 똑같은 3열 카드, 추상 아이콘 나열)을 쓰지 않는다.
- **Don't** 근거 없는 수치, 후기, 효과 보장 문구를 디자인 요소(배지, 카운터)로 만들지 않는다.
- **Don't** 같은 역할의 버튼을 페이지마다 다른 모서리 반경(12px와 100px)으로 만들지 않는다.
- **Don't** 로드되지 않는 폰트에 의존하지 않는다. Pretendard는 반드시 로드하거나 대체 스택을 의도적으로 정한다.
