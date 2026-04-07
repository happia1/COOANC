/**
 * 돼지 저금통 단계 이미지 설정
 *
 * 프레임 좌표·크기는 TexturePacker 가 뽑은 JSON 을 **그대로** 파싱합니다.
 * (`piggy_bank.atlas.json` — `public/.../piggy_bank.json` 과 내용을 맞춰 두세요.)
 *
 * 단계별 개별 PNG 를 쓰려면 `PIGGY_BANK_STAGE_URLS` 를 채우면 URL 이 아틀라스보다 우선합니다.
 */

import piggyBankAtlasJson from '@/constants/piggy_bank.atlas.json'

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
 * 단계별 개별 파일 URL (`public` 기준). 예: `/assets/img/items/piggy-bank/stages/0.png`
 * `null` 이면 사용 안 함. 길이가 1이면 단계와 관계없이 항상 그 한 장만 보입니다.
 */
export const PIGGY_BANK_STAGE_URLS: ReadonlyArray<string> | null = null

/** 현재 설정으로 몇 단계인지(미션·저금통 비율을 `0 .. (n-1)` 로 나눔). 지금은 9단계 고정 흐름과 동일한 길이 */
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
