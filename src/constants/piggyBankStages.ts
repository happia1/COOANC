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
export const PIGGY_BANK_COMBINED_SRC = '/assets/img/items/piggy-bank/piggy_bank.png' as const

/**
 * 합성 PNG 의 실제 픽셀 크기.
 * (현재 저장소에 있는 파일 기준 — 파일을 바꾸면 여기도 맞춰 주세요.)
 */
export const PIGGY_BANK_ATLAS_SIZE = { w: 672, h: 1131 } as const

/**
 * 단계별 잘라낼 영역(픽셀). 위에서 아래·왼쪽에서 오른쪽 순서로 채우면 됩니다.
 * 비어 있으면 “한 장 자르기” 모드는 쓰지 않습니다.
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
  if (PIGGY_BANK_STAGE_RECTS.length > 0) {
    return PIGGY_BANK_STAGE_RECTS.length
  }
  return 1
}
