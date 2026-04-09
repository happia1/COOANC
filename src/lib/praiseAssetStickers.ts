/**
 * 칭찬 스티커 — public/assets/img/items/stickers/ 폴더의 PNG 파일을 씁니다.
 *
 * 왜 키(asset:sticker_01)를 따로 쓰나요?
 * - DB(sprite_key)에는 공백·괄호가 없는 짧은 문자열만 두는 편이 안전합니다.
 * - 실제 파일 이름(heart (1).png, star (1).png 등)은 URL 인코딩으로만 연결합니다.
 */

/**
 * 키 순서와 1:1로 이어지는 파일 이름입니다.
 * - 01~05: 하트 세트(한 줄에 나열)
 * - 06~10: 별 세트(그 다음 줄에 나열)
 */
const STICKER_PNG_FILES = [
  'heart (1).png',
  'heart (2).png',
  'heart (3).png',
  'heart (4).png',
  'heart (5).png',
  'star (1).png',
  'star (2).png',
  'star (3).png',
  'star (4).png',
  'star (5).png',
] as const

/** 부모 패널·API 검증·DB 저장에 쓰는 고정 키 목록(현재 에셋은 하트 5 + 별 5) */
export const PRAISE_ASSET_STICKER_KEYS = [
  'asset:sticker_01',
  'asset:sticker_02',
  'asset:sticker_03',
  'asset:sticker_04',
  'asset:sticker_05',
  'asset:sticker_06',
  'asset:sticker_07',
  'asset:sticker_08',
  'asset:sticker_09',
  'asset:sticker_10',
] as const

export type PraiseAssetStickerKey = (typeof PRAISE_ASSET_STICKER_KEYS)[number]

/** 부모 패널 첫 줄 — 하트 스티커만(위에서 아래로 볼 때 맨 위 행) */
export const PRAISE_ASSET_STICKER_KEYS_ROW_HEART = [
  'asset:sticker_01',
  'asset:sticker_02',
  'asset:sticker_03',
  'asset:sticker_04',
  'asset:sticker_05',
] as const satisfies readonly PraiseAssetStickerKey[]

/** 부모 패널 둘째 줄 — 별 스티커만(하트 다음) */
export const PRAISE_ASSET_STICKER_KEYS_ROW_STAR = [
  'asset:sticker_06',
  'asset:sticker_07',
  'asset:sticker_08',
  'asset:sticker_09',
  'asset:sticker_10',
] as const satisfies readonly PraiseAssetStickerKey[]

/** 펼침 시 위→아래: 하트 행 → 별 행(각 행은 `grid-cols-5`) */
export const PRAISE_ASSET_STICKER_PANEL_BODY_ROWS: readonly (readonly PraiseAssetStickerKey[])[] = [
  PRAISE_ASSET_STICKER_KEYS_ROW_HEART,
  PRAISE_ASSET_STICKER_KEYS_ROW_STAR,
]

/** 부모 화면·툴팁용 제목(키 순번 = sticker_01 → 1번) */
export function praiseAssetStickerTitle(spriteKey: string): string {
  const i = (PRAISE_ASSET_STICKER_KEYS as readonly string[]).indexOf(spriteKey)
  if (i < 0) return '칭찬 스티커'
  return `칭찬 스티커 ${i + 1}`
}

/** 부모 화면 그리드에 쓰는 메타(순서 = 키·파일 순과 동일) — API·검증용 순서와 동일 */
export const PRAISE_ASSET_STICKER_OPTIONS: readonly {
  spriteKey: PraiseAssetStickerKey
  title: string
}[] = PRAISE_ASSET_STICKER_KEYS.map((spriteKey) => ({
  spriteKey,
  title: praiseAssetStickerTitle(spriteKey),
}))

/** 브라우저에서 불러올 경로(공백·괄호는 encodeURIComponent 로 처리) */
export function praiseAssetStickerPublicUrl(fileName: string): string {
  return `/assets/img/items/stickers/${encodeURIComponent(fileName)}`
}

/** DB 키 → 이미지 주소. 우리가 등록한 asset: 스티커가 아니면 null */
export function praiseAssetStickerUrl(spriteKey: string): string | null {
  const i = (PRAISE_ASSET_STICKER_KEYS as readonly string[]).indexOf(spriteKey)
  if (i < 0) return null
  return praiseAssetStickerPublicUrl(STICKER_PNG_FILES[i]!)
}

/** API에서 허용 목록을 만들 때 쓰는지 여부 */
export function isPraiseAssetStickerKey(key: string): key is PraiseAssetStickerKey {
  return (PRAISE_ASSET_STICKER_KEYS as readonly string[]).includes(key)
}
