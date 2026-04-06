/**
 * 스페셜(이벤트) 미션 — description JSON
 * 자녀 앱에서 오늘 카드가 생기면 팝업으로 안내할 때 사용합니다.
 */
export type SpecialMissionMeta = {
  special_delivery?: boolean
  popup_message?: string
}

export function buildSpecialMissionDescription(popupMessage: string | null | undefined): string | null {
  const msg = popupMessage?.trim()
  const payload: SpecialMissionMeta = { special_delivery: true }
  if (msg) payload.popup_message = msg
  return JSON.stringify(payload)
}

export function parseSpecialMissionPopup(description: string | null | undefined): {
  isSpecial: boolean
  popupMessage: string
} {
  if (!description?.trim()) return { isSpecial: false, popupMessage: '' }
  try {
    const j = JSON.parse(description) as SpecialMissionMeta
    if (j?.special_delivery) {
      return {
        isSpecial: true,
        popupMessage: typeof j.popup_message === 'string' ? j.popup_message : '',
      }
    }
  } catch {
    /* 알람 JSON 등 다른 형식 */
  }
  return { isSpecial: false, popupMessage: '' }
}
