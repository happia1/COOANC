/**
 * 돼지 저금통 단계 이미지 설정
 *
 * 합쳐 둔 한 장 PNG 를 쓰는 경우:
 * - 아래 `PIGGY_BANK_ATLAS_SIZE` 에 **실제 파일 가로·세로 픽셀**을 넣고
 * - `PIGGY_BANK_STAGE_RECTS` 에 단계마다 잘라낼 사각형 `{ x, y, w, h }` 를 순서대로 적습니다.
 *   (포토샵·피그마 등에서 선택 영역 좌표를 복사하면 됩니다.)
 *
 * 파일을 나눠 두는 경우(권장 — 좌표 계산 불필요):
 * - `public/assets/img/items/piggy-bank/stages/` 등에 `0.png`, `1.png`, … 처럼 저장하고
 * - `PIGGY_BANK_STAGE_URLS` 에 경로만 나열합니다. **이 배열이 비어 있지 않으면 URL 이 우선**입니다.
 *
 * 둘 다 비어 있으면: `PIGGY_BANK_COMBINED_SRC` 한 장 전체를 작은 상자에 맞춰 보여 줍니다(임시).
 */

/** 한 장에 여러 단계를 붙여 둔 PNG 경로 (`public` 기준) */
export const PIGGY_BANK_COMBINED_SRC = '/assets/img/items/piggy-bank/gold_piggy_bank.png' as const

/**
 * 합성 PNG 의 실제 픽셀 크기.
 * (현재 저장소에 있는 파일 기준 — 파일을 바꾸면 여기도 맞춰 주세요.)
 */
export const PIGGY_BANK_ATLAS_SIZE = { w: 904, h: 759 } as const

type PiggyAtlasFrame = {
  name: string
  x: number
  y: number
  w: number
  h: number
  rotated: boolean
}

/**
 * `gold_piggy_bank.json` 원본 프레임.
 * - TexturePacker 의 `rotated` 값을 그대로 보관해 렌더 시 올바르게 회전 복원합니다.
 */
export const GOLD_PIGGY_BANK_FRAMES: ReadonlyArray<PiggyAtlasFrame> = [
  { name: '레이어 336', x: 210, y: 6, w: 195, h: 187, rotated: false },
  { name: '레이어 337', x: 641, y: 207, w: 228, h: 205, rotated: false },
  { name: '레이어 338', x: 6, y: 205, w: 195, h: 190, rotated: false },
  { name: '레이어 339', x: 213, y: 205, w: 195, h: 190, rotated: false },
  { name: '레이어 340', x: 624, y: 6, w: 195, h: 189, rotated: false },
  { name: '레이어 341', x: 417, y: 6, w: 195, h: 187, rotated: false },
  { name: '레이어 342', x: 6, y: 6, w: 192, h: 183, rotated: false },
  { name: '레이어 343', x: 420, y: 207, w: 193, h: 209, rotated: true },
  { name: '레이어 344', x: 6, y: 407, w: 219, h: 212, rotated: false },
  { name: '레이어 345', x: 237, y: 412, w: 218, h: 318, rotated: true },
  { name: '레이어 346', x: 567, y: 424, w: 331, h: 329, rotated: false },
] as const

/**
 * 저금통 단계 순서(낮음 → 높음).
 * - 크레딧이 늘면 앞에서 뒤로 진행되고, 크레딧이 줄면 같은 경로로 자연스럽게 역행합니다.
 * - 현재 순서는 요청하신 “분홍 돼지 → 점점 화려한 황금 돼지” 흐름에 맞춘 기본값입니다.
 * - 필요하면 아래 배열의 프레임 이름만 바꿔 즉시 미세 조정할 수 있습니다.
 */
export const PIGGY_BANK_STAGE_FRAME_ORDER: ReadonlyArray<string> = [
  // 요청사항: 레이어 336부터 번호 순서대로 적용
  '레이어 336', // 0
  '레이어 337', // 1
  '레이어 338', // 2
  '레이어 339', // 3
  '레이어 340', // 4
  '레이어 341', // 5
  '레이어 342', // 6
  '레이어 343', // 7
  '레이어 344', // 8
  '레이어 345', // 9
  '레이어 346', // 10
] as const

/**
 * (하위 호환) 구 렌더 경로에서 쓰던 사각형 목록.
 * 이제는 `SpriteImage` 경로를 기본으로 쓰므로 비워 둡니다.
 */
export const PIGGY_BANK_STAGE_RECTS: ReadonlyArray<{ x: number; y: number; w: number; h: number }> = []

/**
 * 단계별 개별 파일 URL (`public` 기준). 예: `/assets/img/items/piggy-bank/stages/0.png`
 * `null` 이면 사용 안 함. 길이가 1이면 단계와 관계없이 항상 그 한 장만 보입니다.
 */
export const PIGGY_BANK_STAGE_URLS: ReadonlyArray<string> | null = null

/** 현재 설정으로 몇 단계까지 있는지(미션 비율·저금통 비율 계산에 사용) */
export function piggyBankStageCount(): number {
  if (PIGGY_BANK_STAGE_URLS != null && PIGGY_BANK_STAGE_URLS.length > 0) {
    return PIGGY_BANK_STAGE_URLS.length
  }
  if (PIGGY_BANK_STAGE_FRAME_ORDER.length > 0) {
    return PIGGY_BANK_STAGE_FRAME_ORDER.length
  }
  if (PIGGY_BANK_STAGE_RECTS.length > 0) {
    return PIGGY_BANK_STAGE_RECTS.length
  }
  return 1
}
