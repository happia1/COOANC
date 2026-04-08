/**
 * 칭찬 스티커 — public/assets/img/items/stickers/ 폴더의 PNG 파일을 씁니다.
 *
 * 왜 키(asset:sticker_01)를 따로 쓰나요?
 * - DB(sprite_key)에는 공백·괄호가 없는 짧은 문자열만 두는 편이 안전합니다.
 * - 실제 파일 이름(sticker (1).png 등)은 URL 인코딩으로만 연결합니다.
 */

/** 스티커 파일 이름(폴더 내 실제 파일과 동일해야 합니다) */
const STICKER_PNG_FILES = [
  'sticker (1).png',
  'sticker (2).png',
  'sticker (3).png',
  'sticker (4).png',
  'sticker (5).png',
  'sticker (6).png',
  'sticker (7).png',
  'sticker (8).png',
  'sticker (9).png',
  'sticker (10).png',
  'sticker (11).png',
  'sticker (12).png',
  'sticker (13).png',
  'sticker (14).png',
  'sticker (15).png',
] as const

/** 부모 패널·API 검증·DB 저장에 쓰는 고정 키 목록 */
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
  'asset:sticker_11',
  'asset:sticker_12',
  'asset:sticker_13',
  'asset:sticker_14',
  'asset:sticker_15',
] as const

export type PraiseAssetStickerKey = (typeof PRAISE_ASSET_STICKER_KEYS)[number]

/**
 * 부모 패널 본문 줄 순서: 1줄=하트 모양 PNG 만, 2줄=별 모양 만, 3줄=그 외.
 * `sticker (n).png` ↔ `asset:sticker_0n` 고정이므로, 그림 종류가 다르면 **키만** 아래 세 배열에서 옮깁니다.
 */
export const PRAISE_ASSET_STICKER_KEYS_ROW_HEART = [
  'asset:sticker_01',
  'asset:sticker_02',
  'asset:sticker_03',
  'asset:sticker_04',
  'asset:sticker_05',
] as const satisfies readonly PraiseAssetStickerKey[]

export const PRAISE_ASSET_STICKER_KEYS_ROW_STAR = [
  'asset:sticker_06',
  'asset:sticker_07',
  'asset:sticker_08',
  'asset:sticker_09',
  'asset:sticker_10',
] as const satisfies readonly PraiseAssetStickerKey[]

export const PRAISE_ASSET_STICKER_KEYS_ROW_OTHER = [
  'asset:sticker_11',
  'asset:sticker_12',
  'asset:sticker_13',
  'asset:sticker_14',
  'asset:sticker_15',
] as const satisfies readonly PraiseAssetStickerKey[]

/** 펼침 시 위→아래로 그릴 줄들(텍스트 라벨 없음). 각 줄은 `grid-cols-5` 등에 맞춰 키 나열 */
export const PRAISE_ASSET_STICKER_PANEL_BODY_ROWS: readonly (readonly PraiseAssetStickerKey[])[] = [
  PRAISE_ASSET_STICKER_KEYS_ROW_HEART,
  PRAISE_ASSET_STICKER_KEYS_ROW_STAR,
  PRAISE_ASSET_STICKER_KEYS_ROW_OTHER,
]

/** 부모 화면·툴팁용 제목(키 순번 = sticker_01 → 1번) */
export function praiseAssetStickerTitle(spriteKey: string): string {
  const i = (PRAISE_ASSET_STICKER_KEYS as readonly string[]).indexOf(spriteKey)
  if (i < 0) return '칭찬 스티커'
  return `칭찬 스티커 ${i + 1}`
}

/** 부모 화면 그리드에 쓰는 메타(순서 = 1번~15번 파일) — API·검증용 순서와 동일 */
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
