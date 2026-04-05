/**
 * 생년월일(YYYY-MM-DD)로부터 "만 나이"를 계산합니다.
 * - 비개발자 설명: 기준일과 생일을 연·월·일로 비교해, 올해 생일이 아직이면 한 살 뺍니다.
 * - 달력만 의미 있으므로 UTC 연·월·일로 비교합니다 → Vercel(UTC) API 와 브라우저가 같은 식으로 맞출 수 있어요.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** `YYYY-MM-DD` 가 실제 달력에 있는 날인지(UTC 기준) */
function isValidUtcCalendarDate(y: number, month1to12: number, day: number): boolean {
  const t = Date.UTC(y, month1to12 - 1, day)
  const d = new Date(t)
  return d.getUTCFullYear() === y && d.getUTCMonth() === month1to12 - 1 && d.getUTCDate() === day
}

export type AgeBounds = { min?: number; max?: number }

/**
 * @param birthDateIso `YYYY-MM-DD` (DB date / input[type=date] 값)
 * @param reference 기준 시각(기본: now). UTC 연·월·일만 사용합니다.
 * @param bounds 허용 최소·최대 만 나이(기본 1~18)
 */
export function getAgeFromBirthDateIso(
  birthDateIso: string | null | undefined,
  reference: Date = new Date(),
  bounds: AgeBounds = { min: 1, max: 18 },
): number | null {
  if (!birthDateIso) return null
  const m = ISO_DATE.exec(birthDateIso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!isValidUtcCalendarDate(y, mo, d)) return null

  const ry = reference.getUTCFullYear()
  const rm = reference.getUTCMonth() + 1
  const rd = reference.getUTCDate()

  let age = ry - y
  if (rm < mo || (rm === mo && rd < d)) age -= 1

  const min = bounds.min ?? 1
  const max = bounds.max ?? 18
  if (age < min || age > max) return null
  return age
}

/**
 * 표시용 나이: 생년월일이 있으면 거기서 계산하고, 없으면 DB에 저장된 age 를 씁니다(예전 데이터 호환).
 */
export function resolveDisplayAge(
  birthDate: string | null | undefined,
  storedAge: number | null | undefined,
  reference: Date = new Date(),
): number | null {
  const fromBirth = getAgeFromBirthDateIso(birthDate, reference)
  if (fromBirth != null) return fromBirth
  if (typeof storedAge === 'number' && storedAge >= 1 && storedAge <= 18) return storedAge
  return null
}

/**
 * 온보딩 date 입력: 로컬 "오늘"까지 선택 가능, 최소는 대략 19년 전(달력만).
 * - 실제 허용 연령은 `getAgeFromBirthDateIso` 로 다시 검증(만 1~18)합니다.
 * - 최소를 정확히 "18년 전 오늘"로 잡으면, 일부 만 18세 생일이 입력 범위에서 빠질 수 있어 19년 전으로 넉넉히 둡니다.
 */
export function birthDateInputBounds(reference: Date = new Date()): { min: string; max: string } {
  const max = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  const min = new Date(max)
  min.setFullYear(min.getFullYear() - 19)

  const toIsoLocal = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return { min: toIsoLocal(min), max: toIsoLocal(max) }
}
