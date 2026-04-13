/**
 * 돼지 저금통 단계 이미지 설정
 *
 * 프레임 좌표·크기는 TexturePacker 가 뽑은 JSON 을 **그대로** 파싱합니다.
 * (`piggy_bank.atlas.json` — `public/.../piggy_bank.json` 과 내용을 맞춰 두세요.)
 *
 * 단계별 개별 PNG 를 쓰려면 `PIGGY_BANK_STAGE_URLS` 를 채우면 URL 이 아틀라스보다 우선합니다.
 */

import piggyBankAtlasJson from '@/constants/piggy_bank.atlas.json'

/**
 * 미션 탭(저금통·돈바구니·지갑)에서 **저금통 그림 단계**와 **가운데 가용 크레딧(동전) 그림**을 나눌 때 쓰는 크레딧 상한입니다.
 * 이 값을 넘는 잔액은 시각적으로는 마지막 단계와 동일하게 보입니다.
 */
export const MISSION_CREDITS_STAGE_CAP = 1000 as const

/**
 * 돈바구니 동전 **기준 가로** 배율(0.98 × 1.06 — 예전 1.14 보다 전체적으로 한 단계 작게).
 * 저금통 마지막 단계는 `PiggyBankStageVisual` 의 `PIGGY_CROWN_STAGE_EXTRA` 로 별도 조정.
 */
/** 표현식에는 `as const` 를 붙일 수 없어, 곱셈 결과를 그대로 둡니다 */
export const PIGGY_BANK_VISUAL_MAX_SCALE = 0.98 * 1.06

/** 한 장에 여러 단계를 붙여 둔 PNG 경로 (`public` 기준) */
export const PIGGY_BANK_COMBINED_SRC = '/assets/img/items/piggy-bank/piggy_bank.png' as const

type TpFrameEntry = {
  frame: { x: number; y: number; w: number; h: number }
  rotated: boolean
}

type GoldPiggyAtlasFile = {
  frames: Record<string, TpFrameEntry>
  meta: { size: { w: number; h: number } }
}

export type PiggyAtlasFrame = {
  name: string
  x: number
  y: number
  w: number
  h: number
  rotated: boolean
}

/**
 * `SpriteImage` 와 동일한 규칙: TexturePacker `rotated: true` 이면 화면에 펼쳤을 때 가로·세로가 w↔h 가 바뀝니다.
 */
export function piggyAtlasVisualSize(f: PiggyAtlasFrame): { vw: number; vh: number } {
  return f.rotated ? { vw: f.h, vh: f.w } : { vw: f.w, vh: f.h }
}

/**
 * 저금통 단계 순서(낮음 → 높음). **총 9단계**입니다.
 * - 336~343: 핑크 돼지 → 왕관 쓴 돼지왕(343)까지 (의자·왕좌 344~346 은 사용하지 않음).
 * - 9번째 칸은 크레딧 최상위 구간용으로, 그림은 마지막과 동일하게 343 을 한 번 더 둡니다.
 */
export const PIGGY_BANK_STAGE_FRAME_ORDER: ReadonlyArray<string> = [
  '레이어 336',
  '레이어 337',
  '레이어 338',
  '레이어 339',
  '레이어 340',
  '레이어 341',
  '레이어 342',
  '레이어 343',
  '레이어 343',
] as const

const atlas = piggyBankAtlasJson as GoldPiggyAtlasFile

/** 합성 PNG 의 실제 픽셀 크기 — JSON meta 와 동일해야 함 */
export const PIGGY_BANK_ATLAS_SIZE = { w: atlas.meta.size.w, h: atlas.meta.size.h } as const

/**
 * TexturePacker JSON 의 `frames` 를 단계 순서대로 파싱해 배열로 만듭니다.
 * 키는 반드시 `레이어 NNN.png` 형식이어야 합니다.
 */
function parseGoldPiggyFramesFromAtlas(
  data: GoldPiggyAtlasFile,
  order: ReadonlyArray<string>,
): ReadonlyArray<PiggyAtlasFrame> {
  return order.map((name) => {
    const key = `${name}.png`
    const entry = data.frames[key]
    if (!entry) {
      throw new Error(`[piggyBankStages] piggy_bank.atlas.json 에 키가 없습니다: ${key}`)
    }
    const { x, y, w, h } = entry.frame
    return { name, x, y, w, h, rotated: Boolean(entry.rotated) }
  })
}

/**
 * `SpriteImage` / 렌더에 쓰는 아틀라스 프레임 목록 (좌표는 JSON 과 1:1).
 * 참고: 이번 미션 탭은 아래 `PIGGY_BANK_STAGE_URLS`(14단계 PNG)를 우선 사용합니다.
 */
export const GOLD_PIGGY_BANK_FRAMES: ReadonlyArray<PiggyAtlasFrame> = parseGoldPiggyFramesFromAtlas(
  atlas,
  PIGGY_BANK_STAGE_FRAME_ORDER,
)

/**
 * (하위 호환) 구 렌더 경로에서 쓰던 사각형 목록.
 * 이제는 `SpriteImage` 경로를 기본으로 쓰므로 비워 둡니다.
 */
export const PIGGY_BANK_STAGE_RECTS: ReadonlyArray<{ x: number; y: number; w: number; h: number }> = []

/**
 * 단계별 개별 파일 URL (`public` 기준) — 미션 탭 돼지저금통은 총 14단계로 표시합니다.
 * 비개발자 관점에서 쉽게 보면:
 * - `piggy_bank1.png` 이 가장 초기 모습(0단계)
 * - `piggy_bank14.png` 이 가장 가득 찬 모습(13단계)
 * 코드에서는 배열 인덱스(0부터 시작)로 단계를 고르기 때문에, 파일을 순서대로 나열해 두면
 * 진행도 비율에 맞춰 자동으로 14단계가 자연스럽게 바뀝니다.
 */
export const PIGGY_BANK_STAGE_URLS: ReadonlyArray<string> = [
  '/assets/img/items/rewards/piggybank/piggy_bank1.png',
  '/assets/img/items/rewards/piggybank/piggy_bank2.png',
  '/assets/img/items/rewards/piggybank/piggy_bank3.png',
  '/assets/img/items/rewards/piggybank/piggy_bank4.png',
  '/assets/img/items/rewards/piggybank/piggy_bank5.png',
  '/assets/img/items/rewards/piggybank/piggy_bank6.png',
  '/assets/img/items/rewards/piggybank/piggy_bank7.png',
  '/assets/img/items/rewards/piggybank/piggy_bank8.png',
  '/assets/img/items/rewards/piggybank/piggy_bank9.png',
  '/assets/img/items/rewards/piggybank/piggy_bank10.png',
  '/assets/img/items/rewards/piggybank/piggy_bank11.png',
  '/assets/img/items/rewards/piggybank/piggy_bank12.png',
  '/assets/img/items/rewards/piggybank/piggy_bank13.png',
  '/assets/img/items/rewards/piggybank/piggy_bank14.png',
] as const

/** 현재 설정으로 몇 단계인지(미션·저금통 비율을 `0 .. (n-1)` 로 나눔). 지금은 URL 목록 길이(14단계)를 우선 사용 */
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
