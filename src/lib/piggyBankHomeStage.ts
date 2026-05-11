/**
 * 자녀 홈 저금통 PNG 단계 — 저금통에 **들어 있는** 크레딧(`credits_piggy`) 기준으로 14장 중 하나를 고릅니다.
 *
 * 비개발자 설명:
 * - 그림은 `public/assets/img/items/rewards/piggybank/piggy_bank1.png` ~ `piggy_bank14.png` 입니다.
 * - 저금액이 0에 가까우면 1번 그림, 많아질수록 뒤쪽 번호로 바뀝니다.
 * - 최대 **1000 크레딧**을 14단계로 나눕니다(그 이상도 마지막 그림과 같게 보입니다).
 */

import { PIGGY_BANK_STAGE_URLS } from '@/constants/piggyBankStages'

/** 저금통 그림이 따라가는 상한 크레딧 — 넘치면 마지막(가장 가득 찬) 그림을 유지합니다. */
export const CHILD_HOME_PIGGY_VISUAL_CAP = 1000

const N = PIGGY_BANK_STAGE_URLS.length

/**
 * `credits_piggy`(저금통 잔액) → 배열 인덱스 0..N-1 (PNG 번호는 인덱스+1).
 */
export function piggyBankVisualFrameIndexFromSavedCredits(saved: number): number {
  const c = Math.max(0, Math.floor(saved))
  if (c >= CHILD_HOME_PIGGY_VISUAL_CAP) return N - 1
  return Math.min(N - 1, Math.floor((c / CHILD_HOME_PIGGY_VISUAL_CAP) * N))
}

export function piggyBankVisualUrlFromSavedCredits(saved: number): string {
  return PIGGY_BANK_STAGE_URLS[piggyBankVisualFrameIndexFromSavedCredits(saved)] ?? PIGGY_BANK_STAGE_URLS[0]
}
