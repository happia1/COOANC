import type { CSSProperties } from 'react'

/**
 * 자녀 홈 상단 — 레벨 카드와 크레딧 카드에 공통으로 쓰는 반투명·블러·모서리 둥글기.
 * 비개발자: 두 박스가 같은 ‘유리판’ 느낌으로 보이게 맞춘 값입니다.
 */
export const CHILD_HOME_TOP_BAR_GLASS_STYLE: CSSProperties = {
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(10px)',
}

/** `style` 과 함께 쓰는 Tailwind 클래스 — 그림자·라운드 */
export const CHILD_HOME_TOP_BAR_GLASS_CLASS = 'rounded-2xl shadow-lg'
