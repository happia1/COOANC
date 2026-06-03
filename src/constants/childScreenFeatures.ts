/**
 * 자녀 앱 단일 화면 기능 해금 정의
 *
 * 비개발자 설명:
 * - 아이의 레벨(current_level)에 따라 어떤 기능을 보여줄지 결정합니다.
 * - 레벨 5부터 홈 **저금통**이 열립니다.
 */

import { isPiggyBankUnlocked } from '@/constants/childAgeConfig'

/** 칭찬 스티커 판(우측 상단 아이콘) 해금 — 레벨 1 이상 */
export const STICKER_UNLOCK_MIN_LEVEL = 1

/** 보물상자·콘텐츠 이용권 해금 — 레벨 8 이상 */
export const CONTENT_ZONE_UNLOCK_MIN_LEVEL = 8

/** 레벨 기준 보물상자(콘텐츠존) 사용 가능 여부 */
export function isContentZoneUnlocked(level: number): boolean {
  return level >= CONTENT_ZONE_UNLOCK_MIN_LEVEL
}

/** 감정카드·일기 해금 예정 — Lv.10 (미구현) */
/** 과일·꽃 팔기 해금 예정 — Lv.12 (미구현) */

export type UnlockedFeatures = {
  missions: boolean
  market: boolean
  contentZone: boolean
  /** 홈 저금통 — 레벨 5 이상 */
  piggyBank: boolean
  sticker: boolean
}

export function getUnlockedFeatures(level: number, ageYears: number | null): UnlockedFeatures {
  void ageYears

  return {
    missions: true,
    market: true,
    contentZone: isContentZoneUnlocked(level),
    piggyBank: isPiggyBankUnlocked(level),
    sticker: level >= STICKER_UNLOCK_MIN_LEVEL,
  }
}
