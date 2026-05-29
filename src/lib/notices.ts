/**
 * 공지(notices) 공통 라이브러리
 *
 * 비개발자 설명:
 * - 공지/팝업을 화면 여러 곳(공지센터, 앱 실행 팝업)에서 똑같은 규칙으로 불러오도록
 *   "데이터 모델 + 조회 규칙 + 분류 규칙"을 한 파일에 모았습니다.
 * - 이렇게 하면 화면마다 규칙이 달라져서 생기는 버그를 막을 수 있습니다.
 *
 * 담당 범위:
 * - STEP 1: 활성/기간 조건으로 공지 조회 + 정렬 (운영형 CMS 구조)
 * - STEP 2: Notice 모델(camelCase) + fromJson/toJson + null 안전 + 날짜(Date) 변환
 * - STEP 3: notice_type(공지 종류) ↔ 한글 섹션 제목 매핑
 * - STEP 6: 앱 실행 시 띄울 팝업 1개를 우선순위로 고르는 로직
 * - STEP 8: 링크 버튼 기본 라벨
 */

import { createClient } from '@/lib/supabase/client'

/** 공지 종류 — DB notice_type 값과 1:1로 맞춥니다 */
export type NoticeType = 'notice' | 'guide' | 'event' | 'update' | 'info'

/** 팝업 노출 방식 — DB popup_type 값과 1:1로 맞춥니다 */
export type PopupType = 'none' | 'once' | 'important' | 'force'

/**
 * STEP 2: 앱에서 사용하는 Notice 모델 (camelCase).
 * - DB는 snake_case(예: link_url)지만, 화면 코드에서는 다루기 쉬운 camelCase로 씁니다.
 * - 날짜 칸은 문자열이 아니라 Date 객체로 변환해 둡니다.
 */
export type Notice = {
  id: string
  title: string
  body: string
  linkUrl: string | null
  linkLabel: string | null
  orderIndex: number
  isActive: boolean
  startAt: Date | null
  endAt: Date | null
  noticeType: NoticeType
  popupType: PopupType
  popupUntil: Date | null
  createdAt: Date | null
}

/** 과거 import 호환용 별칭 — 다른 파일에서 NoticeRow 를 쓰던 경우를 위해 남겨 둡니다 */
export type NoticeRow = Notice

/** 링크 버튼에 라벨이 없을 때 쓰는 기본 문구 (STEP 8) */
export const NOTICE_LINK_DEFAULT_LABEL = '자세히 보기'

/**
 * STEP 3: 공지 종류 → 한글 섹션 제목 매핑.
 * 섹션을 "이 순서대로" 위에서 아래로 보여 줍니다.
 */
export const NOTICE_TYPE_ORDER: NoticeType[] = ['notice', 'guide', 'event', 'update', 'info']

export const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  notice: '공지사항',
  guide: '사용 가이드',
  event: '이벤트',
  update: '업데이트',
  info: '안내사항',
}

/** notice_type 이 비어 있거나(null) 알 수 없는 값이면 기본 'notice' 로 봅니다 */
export function resolveNoticeType(value: unknown): NoticeType {
  if (typeof value === 'string' && (NOTICE_TYPE_ORDER as string[]).includes(value)) {
    return value as NoticeType
  }
  return 'notice'
}

/** popup_type 이 비어 있거나 알 수 없는 값이면 기본 'none' 으로 봅니다 */
export function resolvePopupType(value: unknown): PopupType {
  const allowed: PopupType[] = ['none', 'once', 'important', 'force']
  if (typeof value === 'string' && (allowed as string[]).includes(value)) {
    return value as PopupType
  }
  return 'none'
}

/* ------------------------------------------------------------------ *
 * null 안전 변환 도우미들 (STEP 2)
 * ------------------------------------------------------------------ */

/** 값을 문자열로, 없으면 null */
function asStringOrNull(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value == null) return null
  return String(value)
}

/** 값을 숫자로, 없거나 숫자가 아니면 기본값 */
function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return fallback
}

/** 값을 불리언으로, 애매하면 기본값 */
function asBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

/** 값을 Date 로, 비었거나 잘못된 형식이면 null */
function asDateOrNull(value: unknown): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * STEP 2: DB(JSON) 한 줄 → Notice 모델로 변환(fromJson).
 * - 모든 칸을 null 안전하게 읽고, 날짜는 Date 로 바꿉니다.
 */
export function noticeFromJson(json: Record<string, unknown> | null | undefined): Notice {
  const j = json ?? {}
  return {
    id: asStringOrNull(j.id) ?? '',
    title: asStringOrNull(j.title) ?? '',
    body: asStringOrNull(j.body) ?? '',
    linkUrl: asStringOrNull(j.link_url),
    linkLabel: asStringOrNull(j.link_label),
    orderIndex: asNumber(j.order_index, 0),
    isActive: asBoolean(j.is_active, true),
    startAt: asDateOrNull(j.start_at),
    endAt: asDateOrNull(j.end_at),
    noticeType: resolveNoticeType(j.notice_type),
    popupType: resolvePopupType(j.popup_type),
    popupUntil: asDateOrNull(j.popup_until),
    createdAt: asDateOrNull(j.created_at),
  }
}

/**
 * STEP 2: Notice 모델 → DB(JSON) 한 줄로 변환(toJson).
 * - camelCase → snake_case, Date → ISO 문자열.
 * - id 가 비어 있으면(신규) 보내지 않아 DB 기본값(gen_random_uuid)을 쓰게 합니다.
 */
export function noticeToJson(notice: Notice): Record<string, unknown> {
  const json: Record<string, unknown> = {
    title: notice.title,
    body: notice.body,
    link_url: notice.linkUrl,
    link_label: notice.linkLabel,
    order_index: notice.orderIndex,
    is_active: notice.isActive,
    start_at: notice.startAt ? notice.startAt.toISOString() : null,
    end_at: notice.endAt ? notice.endAt.toISOString() : null,
    notice_type: notice.noticeType,
    popup_type: notice.popupType,
    popup_until: notice.popupUntil ? notice.popupUntil.toISOString() : null,
    created_at: notice.createdAt ? notice.createdAt.toISOString() : null,
  }
  if (notice.id) json.id = notice.id
  return json
}

/** DB에서 select 할 컬럼 목록 (조회 위치마다 동일하게 사용) */
const NOTICE_SELECT_COLUMNS =
  'id, title, body, link_url, link_label, order_index, is_active, notice_type, popup_type, popup_until, start_at, end_at, created_at'

/**
 * STEP 1: 현재 노출 대상인 활성 공지를 모두 가져옵니다. (운영형 CMS 조회)
 *
 * 조회 조건:
 * - is_active = true
 * - start_at 이 null 이거나 현재 시간 이전(=이미 시작)
 * - end_at 이 null 이거나 현재 시간 이후(=아직 안 끝남)
 *
 * 정렬:
 * 1) order_index 오름차순
 * 2) created_at 최신순(desc) — 보조 정렬
 *
 * 결과는 Notice 모델(camelCase, Date 변환 완료)로 돌려줍니다.
 */
export async function fetchActiveNotices(): Promise<{
  notices: Notice[]
  errorMessage: string | null
}> {
  const supabase = createClient()
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('notices')
    .select(NOTICE_SELECT_COLUMNS)
    .eq('is_active', true)
    // start_at 이 비었거나(=즉시 노출) 이미 시작된 것
    .or(`start_at.is.null,start_at.lte.${nowIso}`)
    // end_at 이 비었거나(=무기한) 아직 안 끝난 것
    .or(`end_at.is.null,end_at.gte.${nowIso}`)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    return { notices: [], errorMessage: error.message || '공지를 불러오지 못했어요.' }
  }

  const notices = (data ?? []).map((row) => noticeFromJson(row as Record<string, unknown>))
  return { notices, errorMessage: null }
}

/**
 * STEP 3: 공지 목록을 notice_type 별 섹션으로 묶습니다.
 * - 정해진 순서(NOTICE_TYPE_ORDER)대로 반환합니다.
 * - 비어 있는 종류는 결과에서 빠지므로, 화면에서 "데이터 없는 섹션 숨김"이 자연히 됩니다.
 * - 입력이 order_index→created_at 순으로 정렬돼 있으면, 각 섹션 내부도 그 순서가 유지됩니다.
 */
export function groupNoticesByType(
  notices: Notice[],
): Array<{ type: NoticeType; label: string; items: Notice[] }> {
  return NOTICE_TYPE_ORDER.map((type) => ({
    type,
    label: NOTICE_TYPE_LABELS[type],
    items: notices.filter((n) => n.noticeType === type),
  })).filter((section) => section.items.length > 0)
}

/** 팝업 우선순위(클수록 먼저) — STEP 6 */
const POPUP_PRIORITY: Record<Exclude<PopupType, 'none'>, number> = {
  force: 3,
  important: 2,
  once: 1,
}

/**
 * STEP 5 + STEP 6: 활성 공지들 중에서 "지금 앱 실행 시 띄울 팝업 1개"를 고릅니다.
 *
 * 노출 조건:
 * - popup_type != 'none'
 * - popup_until 이 null 이거나 현재 시각 이후(아직 안 지남)
 *   (is_active / start_at / end_at 기간 조건은 fetchActiveNotices 단계에서 이미 걸러졌다고 가정)
 *
 * 우선순위:
 * 1) force > 2) important > 3) once
 * 동일 우선순위면 order_index 오름차순 → created_at 최신순(보조)
 *   (입력 notices 가 이미 그 순서이므로, 안정 정렬로 "타입 우선순위"만 다시 적용)
 */
export function pickLaunchPopupNotice(notices: Notice[], now: Date = new Date()): Notice | null {
  const candidates = notices.filter((n) => {
    if (n.popupType === 'none') return false
    if (n.popupUntil && n.popupUntil.getTime() <= now.getTime()) return false
    return true
  })

  if (candidates.length === 0) return null

  const sorted = [...candidates].sort((a, b) => {
    const pa = a.popupType === 'none' ? 0 : POPUP_PRIORITY[a.popupType]
    const pb = b.popupType === 'none' ? 0 : POPUP_PRIORITY[b.popupType]
    return pb - pa
  })

  return sorted[0] ?? null
}
