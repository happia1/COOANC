/**
 * 마켓 애니메이션 아틀라스의 sticker_board.png 프레임(512×730) 기준 퍼센트 레이아웃입니다.
 * (TexturePacker animations.json 의 frame 크기와 동일해야 좌표가 맞습니다.)
 */
export const BEAR_BOARD_FRAME_W = 512
export const BEAR_BOARD_FRAME_H = 730
export const BEAR_BOARD_ASPECT = BEAR_BOARD_FRAME_W / BEAR_BOARD_FRAME_H

/**
 * 곰이 들고 있는 하얀 종이 안 — 스티커 플로팅 구역(sticker_board.png 512×730 기준으로 아래·가운데 쪽이 실제 종이에 가깝습니다).
 */
export const BEAR_PAPER_ZONE = { left: 16, top: 30, width: 68, height: 18 } as const

/** 보라 상자 위 숫자 원판 그리드 영역(512×730 프레임 기준 %) */
export const BEAR_GRID_ZONE = { left: 16, top: 54, width: 68, height: 34 } as const

/** 일러스트(sticker_board)는 한 줄에 1~5번이 가로로 5칸, 아래로 4줄(총 20칸) */
export const BEAR_GRID_COLS = 5
export const BEAR_GRID_ROWS = 4

/**
 * 아틀라스 % 격자와 실제 원 중심이 어긋날 때 보정(전체 보드 너비·높이 100% 기준).
 * (현장 피드백: 1번 칸이 6·7번 쪽으로 치우침 → 가로로 왼쪽으로 당김)
 */
export const BEAR_GRID_NUDGE_X_PCT = -6.5
/**
 * 세로: 일러스트의 숫자 원 한 줄 높이만큼 위로 당겨 격자 중심과 그림이 맞도록 함(피드백: 한 줄 아래로 밀려 있음).
 * 값 = -(그리드 구역 높이 ÷ 행 수) → 정확히 한 행 분량 이동
 */
export const BEAR_GRID_NUDGE_Y_PCT = -(BEAR_GRID_ZONE.height / BEAR_GRID_ROWS)

/** 슬롯 1~20 → 그리드 셀 중심 좌표(% of board) */
export function slotCenterPercent(slot: number): { x: number; y: number } | null {
  if (slot < 1 || slot > 20) return null
  const idx = slot - 1
  const col = idx % BEAR_GRID_COLS
  const row = Math.floor(idx / BEAR_GRID_COLS)
  const cw = BEAR_GRID_ZONE.width / BEAR_GRID_COLS
  const ch = BEAR_GRID_ZONE.height / BEAR_GRID_ROWS
  const x = BEAR_GRID_ZONE.left + (col + 0.5) * cw + BEAR_GRID_NUDGE_X_PCT
  const y = BEAR_GRID_ZONE.top + (row + 0.5) * ch + BEAR_GRID_NUDGE_Y_PCT
  return { x, y }
}

/** 드롭 존 반지름(그리드 셀 짧은 변의 약 42%) */
export function slotRadiusPercent(): number {
  const cw = BEAR_GRID_ZONE.width / BEAR_GRID_COLS
  const ch = BEAR_GRID_ZONE.height / BEAR_GRID_ROWS
  return (Math.min(cw, ch) / 2) * 0.42
}
