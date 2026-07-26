/**
 * 아이 성장 — 레벨·존·뱃지 (독립 개념)
 *
 * - 레벨: 숫자만 (Lv.N)
 * - 존: 레벨 구간별 세계관 (정원·마을·항구·바다)
 * - 뱃지: 특정 레벨 달성 시만 획득하는 칭호
 */

// ── 존 정의 ──────────────────────────────
export const CHILD_ZONES = [
  { zone: '정원', emoji: '🌱', minLevel: 0, maxLevel: 4 },
  { zone: '마을', emoji: '🏘️', minLevel: 5, maxLevel: 8 },
  { zone: '항구', emoji: '⚓', minLevel: 9, maxLevel: 12 },
  { zone: '바다', emoji: '⛵', minLevel: 13, maxLevel: Infinity },
] as const

export type ChildZone = (typeof CHILD_ZONES)[number]

/** 레벨 → 현재 존 반환 */
export function getChildZone(level: number): ChildZone {
  return (
    CHILD_ZONES.find((z) => level >= z.minLevel && level <= z.maxLevel) ??
    CHILD_ZONES[CHILD_ZONES.length - 1]
  )
}

// ── 뱃지 정의 (특정 레벨 달성 시만) ──────
export const CHILD_BADGES = [
  { level: 1, badge: '새싹', emoji: '🌿' },
  { level: 5, badge: '저축왕', emoji: '💰' },
  { level: 8, badge: '사업가', emoji: '🏪' },
  { level: 10, badge: '탐험가', emoji: '🗺️' },
  { level: 12, badge: '선장', emoji: '⛵' },
] as const

export type ChildBadgeEntry = (typeof CHILD_BADGES)[number]

/** 레벨 → 뱃지 반환 (없으면 null) */
export function getChildBadge(level: number): ChildBadgeEntry | null {
  return CHILD_BADGES.find((b) => b.level === level) ?? null
}

/** 레벨 → 지금까지 획득한 뱃지 전체 반환 */
export function getChildEarnedBadges(level: number): ChildBadgeEntry[] {
  return CHILD_BADGES.filter((b) => b.level <= level)
}

/** 단계 이름 대체: 뱃지 칭호, 없으면 「레벨 N」 */
export function childGrowthStageLabel(level: number): string {
  return getChildBadge(level)?.badge ?? `레벨 ${level}`
}

// ── 부모 가이드 문구 (레벨별) ─────────────
/**
 * 부모에게 보여 줄 레벨별 안내.
 *
 * 작성 기준:
 * - **기능 위주**로 씁니다. 「지금 무엇이 열려 있고, 이 레벨에서 무엇을 할 수 있는지」가 먼저입니다.
 *   정원·마을·항구 같은 세계관 용어는 앱 안에 인트로가 없어 부모가 알 수 없으므로 문구에 쓰지 않습니다.
 *   (존 이름은 화면의 작은 칩으로만 보여 줍니다.)
 * - 아직 만들지 않은 기능은 예고하지 않습니다.
 * - 한 줄로 길게 늘어놓지 않고 `\n\n` 으로 문단을 나눕니다.
 *     첫 문단 = 지금 쓸 수 있는 기능
 *     둘째 문단 = 부모가 오늘 해 볼 것 한 가지
 *   화면에서는 `whitespace-pre-line` 으로 줄바꿈이 그대로 보입니다.
 */
export const PARENT_GUIDES: Record<number, string> = {
  0:
    '미션·화분·마켓이 열려 있어요. 미션을 끝내면 크레딧과 하트가 쌓이고, ' +
    '마켓에서 갖고 싶은 걸 고르면 부모님께 승인 요청이 옵니다.\n\n' +
    '오늘은 아이와 미션 카드를 함께 읽으며 "이건 언제 할까?" 정해 보세요.',
  1:
    '칭찬 스티커가 열렸어요. 미션을 끝낼 때마다 스티커를 받아 판에 붙일 수 있어요.\n\n' +
    '판을 다 채우면 무엇을 할지 미리 약속해 두세요. 약속이 있으면 스티커 한 장의 무게가 달라져요.',
  2:
    '새로 열리는 기능은 없어요. 미션을 반복하며 습관이 자리 잡는 구간입니다.\n\n' +
    '잘 지킨 미션 하나를 골라 이름 붙여 칭찬해 주세요 — "이 닦기 3일 연속!"',
  3:
    '화분을 키우는 재미가 붙는 구간이에요. 물조리개로 하트를 주면 게이지가 차고, ' +
    '한 단계씩 자라 꽃이 피고 열매가 맺혀요.\n\n' +
    '오늘 화분이 어디까지 자랐는지 아이에게 물어봐 주세요.',
  4:
    '다음 레벨에서 저금통이 열려요. 지금은 번 크레딧을 바로 쓰는 것만 할 수 있어요.\n\n' +
    '"사고 싶은 것"을 하나 물어봐 주세요. 목표가 있으면 저금이 참는 일이 아니라 모으는 일이 됩니다.',
  5:
    '저금통이 열렸어요. 크레딧을 저금통에 옮겨 둘 수 있고, 10개 이상 모으면 3일마다 이자가 붙어요. ' +
    '이자는 저금통 위에 반짝이는 코인으로 떠서, 아이가 눌러야 받아 갑니다.\n\n' +
    '크레딧을 쓸지 모을지 아이가 직접 고르게 해주세요.',
  6:
    '저금통에 많이 모을수록 이자율이 올라가요.\n' +
    '10개 이상 1% · 50개 이상 1.5% · 100개 이상 2% · 200개 이상 2.5% (3일마다)\n\n' +
    '저금통을 함께 열어 보세요. "가만히 뒀는데 왜 늘었을까?"를 아이가 설명하게 해보면 ' +
    '그게 첫 금융 수업이 됩니다.',
  7:
    '다음 레벨에서 보물상자가 열려요. 모은 크레딧으로 이용권을 사서 영상을 볼 수 있게 됩니다.\n\n' +
    '갖고 싶은 것의 가격과 지금 저금통 잔액을 아이와 함께 세어 보세요.',
  8:
    '보물상자가 열렸어요. 아이가 이용권을 사면 부모님 승인 후 크레딧이 빠지고, ' +
    '보물상자 옆에 쓸 수 있는 개수가 숫자로 떠요.\n\n' +
    '몇 개 살지는 아이가 정하게 하되, 「산 시간만큼만 이용한다」는 약속을 함께 정해 주세요.',
  9:
    '새로 열리는 기능은 없지만, 미션·저금통·마켓·보물상자를 모두 쓸 수 있는 단계예요.\n\n' +
    '처음과 지금 무엇이 달라졌는지 아이에게 말로 짚어 주세요.',
  10:
    '보물상자에 미니게임이 열렸어요. 이용권은 영상과 같은 것을 쓰고, ' +
    '두뇌발달을 돕는 게임을 할 수 있어요.\n\n' +
    '같은 이용권을 영상에 쓸지 게임에 쓸지 아이가 고르게 해주세요.',
  11:
    '벌고·모으고·쓰는 한 바퀴를 아이 혼자 돌 수 있는 단계예요.\n\n' +
    '이번 주엔 부모가 정하지 말고 아이 결정을 그대로 따라가 보세요.',
  12:
    '지금까지 열린 기능을 모두 쓰고 있어요 — 미션·화분·마켓·칭찬 스티커·저금통·보물상자·미니게임.\n\n' +
    '한 주 크레딧을 통째로 맡기고 계획을 세워 보게 해도 좋아요.',
  15:
    '항해지도가 열렸어요. 캐릭터를 누르면 지금까지의 여정을 지도로 볼 수 있어요.\n\n' +
    '처음 시작한 날부터 여기까지 온 길을 아이와 함께 되짚어 보세요.',
}

/**
 * 13레벨 이상 공통 문구.
 * 위 표에 없는 레벨은 이 문구를 씁니다(빈 카드가 뜨지 않도록).
 * 나중에 상위 레벨 기능이 생기면 `PARENT_GUIDES` 에 해당 레벨을 추가하면 이 문구를 대신합니다.
 */
export const PARENT_GUIDE_FALLBACK =
  '지금까지 열린 기능을 모두 쓸 수 있어요. 이제 아이의 습관이 앱보다 앞서 가는 단계입니다.\n\n' +
  '모은 크레딧을 실제 용돈이나 통장으로 옮겨 보는 것도 좋은 다음 단계예요.'

/**
 * 레벨 → 부모 가이드 문구.
 * 표에 없는 레벨(13 이상 등)은 공통 문구를 돌려주므로 `null` 이 나오지 않습니다.
 */
export function getParentGuide(level: number): string {
  return PARENT_GUIDES[level] ?? PARENT_GUIDE_FALLBACK
}
