/**
 * 지갑 크레딧 → 9단계 PNG(`public/assets/img/items/rewards/wallet/wallet1~9.png`) 매핑
 *
 * - 잔액이 많을수록 단계가 올라가며, 0~`WALLET_CREDITS_CAP`를 9구간으로 균등 분할합니다.
 * - 그 이상의 크레딧은 마지막 단계(9번 그림)와 동일하게 표시합니다.
 */

/** 지갑 단계 계산에 쓰는 상한(이 값 이상은 마지막 단계) */
export const WALLET_CREDITS_CAP = 1000

/** 사용 중인 지갑 일러스트 단계 수(wallet1.png ~ wallet9.png) */
export const WALLET_STAGE_COUNT = 9

/**
 * 지갑 PNG 를 바꿨는데도 예전 그림이 보이면 이 값을 1 올리세요.
 * `next.config.mjs` 안의 WALLET_IMAGE_CACHE_BUST 문자열과 **같은 숫자**여야 Next 16 에서 이미지가 로드됩니다.
 */
export const WALLET_IMAGE_CACHE_BUST = 4

/**
 * 지갑에 든 크레딧으로 0~(WALLET_STAGE_COUNT-1) 단계 인덱스를 고릅니다.
 * (미션 섬·마켓·옮기기 팝업에서 동일 규칙을 쓰기 위해 한곳에 둡니다.)
 */
export function walletStageIndexByCredits(walletCredits: number): number {
  const clamped = Math.max(0, Math.min(walletCredits, WALLET_CREDITS_CAP))
  const band = WALLET_CREDITS_CAP / WALLET_STAGE_COUNT
  return Math.min(WALLET_STAGE_COUNT - 1, Math.floor(clamped / band))
}

/**
 * 단계 인덱스를 `walletN.png` 경로로 바꿉니다.
 * `?v=` 는 브라우저·`/_next/image` 디스크 캐시를 비우기 위한 버전입니다(파일 내용만 바꾸면 URL 이 같아져 옛 그림이 남을 수 있음).
 */
export function walletImageSrcByStage(stageIndex: number): string {
  const idx = Math.max(0, Math.min(stageIndex, WALLET_STAGE_COUNT - 1))
  return `/assets/img/items/rewards/wallet/wallet${idx + 1}.png?v=${WALLET_IMAGE_CACHE_BUST}`
}

/** 크레딧만 넘기면 바로 표시용 URL을 돌려줍니다. */
export function walletImageSrcByCredits(walletCredits: number): string {
  return walletImageSrcByStage(walletStageIndexByCredits(walletCredits))
}
