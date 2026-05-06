/**
 * Supabase 테이블 Row 타입 정의
 * DB 스키마 변경 시 이 파일을 함께 업데이트하세요.
 */

export type UserRole = 'parent' | 'child'

export type Profile = {
  id: string
  role: UserRole
  name: string
  /** 자녀 연령(세). 생년월일이 있으면 표시는 생일 기반으로 계산하고 이 값은 보조·호환용 */
  age: number | null
  /** 자녀 생년월일 YYYY-MM-DD (만 나이 계산의 기준) */
  birth_date: string | null
  /** 미취학(preschool) / 학령기(school) — 온보딩·설정에서 저장(구 DB 는 없을 수 있음) */
  age_group?: 'preschool' | 'school' | null
  /** 가정보육·어린이집·유치원·학교 코드 — 루틴·알림과 카드 표시에 사용 */
  institution_type?: 'home' | 'daycare' | 'kindergarten' | 'school' | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type FamilyLink = {
  id: string
  parent_id: string
  child_id: string
  nickname: string | null
  created_at: string
}

export type ChildStats = {
  id: string
  child_id: string
  credits: number
  /** 마켓 등 지출에 쓰는 「지갑」분(마이그레이션 전 DB 는 없을 수 있음 → 전부 지갑으로 간주) */
  credits_wallet?: number
  /** 「저금통」에 넣어 둔 크레딧 */
  credits_piggy?: number
  hearts: number
  total_credits_earned: number
  current_level: number         // 0~5
  exp: number
  exp_to_next_level: number
  /** 만족 지연 지수 0~100 — 전체 credits 대비 저금통(credits_piggy) 비율 */
  eq_delay_score: number
  /** 루틴 완주율 0~100 — 최근 14일 mission_logs 기준 */
  eq_routine_rate: number
  /** 저축 비중 0~100 — 지갑+저금통 중 저금통 비율(돈바구니·가용은 분모 제외) */
  eq_save_ratio: number
  streak_days: number
  last_mission_date: string | null
  longest_streak: number
  promotion_pending: boolean
  promotion_eligible_at: string | null
  /**
   * 스티커 판 20칸 완주 후 서버에서 판을 비울 때 갱신됨.
   * 이보다 먼저 받은 칭찬 스티커(grant)는 팝업 종이 위 「새로 붙일 스티커」에서 제외(새 사이클만 표시).
   */
  praise_board_cleared_at?: string | null
  /** 항해 섹션 (0=연안, 1=근해, 2=외해, 3=심해) */
  boat_section?: number
  /** 현재 섹션 내 배 위치 (0~STEPS_PER_SECTION-1) */
  boat_step?: number
  /** 하루 1회 배 이동 게이트: 마지막으로 하트 5개를 채운 날짜 (YYYY-MM-DD) */
  last_hearts_full_date?: string | null
  /**
   * 잘 준비 알림 시각 HH:MM — 부모 루틴 알람 설정에서 지정, 자녀 화면에서 해당 분에 팝업
   */
  sleep_ready_time?: string | null
  sleep_ready_time_enabled?: boolean
  sleep_ready_time_weekday?: boolean
  sleep_ready_time_weekend?: boolean
  /** 등원 알림 HH:MM */
  school_time?: string | null
  school_time_enabled?: boolean
  school_time_weekday?: boolean
  school_time_weekend?: boolean
  /**
   * 서울 달력 기준: 자녀가 그날 미션을 모두 끝내고 수면 모드로 들어간 날.
   * 그날 배정된 미션은 부모 롤백이 막힙니다.
   */
  sleep_session_locked_date?: string | null
  /** 화분 성장 단계 0~6 (없으면 0 으로 간주) */
  pot_stage?: number
  /** 현재 단계에서 물주기로 쓴 하트 누적 */
  pot_hearts_used?: number
  /** 완성(6단계) 후 씨앗 선택 전 */
  pot_completed?: boolean
  /** 심은 나무 종류 코드 (예: apple) */
  pot_tree_id?: string
  created_at: string
  updated_at: string
}

export type Mission = {
  id: string
  level_required: number
  title: string
  description: string | null
  icon_emoji: string
  credit_reward: number
  heart_reward: number
  exp_reward: number
  /** 완료 시 보상 배율(1·2·3). 스페셜 미션만 부모가 변경 — 구 DB 는 1로 간주 */
  reward_multiplier?: number | null
  concept_tag: '미션' | '교환' | '저축' | '나눔' | '투자' | '도전' | '학습' | '기여' | '건강' | '습관' | null
  difficulty: 'easy' | 'normal' | 'hard' | 'special'
  repeat_type: 'daily' | 'weekly' | 'monthly' | 'event'
  /** 루틴 블록 */
  block: 'morning' | 'afternoon' | 'evening' | 'bedtime' | null
  /** 실행 예정 시간 HH:MM (예: "07:30"). null이면 시간 미지정 */
  scheduled_time: string | null
  /** 이 템플릿이 귀속된 자녀(온보딩·루틴에서 생성). null 이면 전역 풀 */
  linked_child_id: string | null
  /**
   * 부모 루틴에서 드래그로 지정한 표시 순서(같은 block·같은 구간 내).
   * 0이면 기존 칩 순위·시간 순을 씁니다. 구 DB·부분 조회에는 필드가 없을 수 있어 옵션입니다.
   */
  sort_order?: number
  is_active: boolean
  created_at: string
}

export type DailyMission = {
  id: string
  child_id: string
  mission_template_id: string
  date: string          // YYYY-MM-DD
  scheduled_time: string | null  // HH:MM
  routine_type: 'weekday' | 'weekend' | 'holiday' | 'vacation' | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

/** daily_missions + missions 조인 결과 */
export type DailyMissionWithTemplate = DailyMission & {
  missions: Pick<
    Mission,
    | 'title'
    | 'icon_emoji'
    | 'description'
    | 'credit_reward'
    | 'heart_reward'
    | 'exp_reward'
    | 'reward_multiplier'
    | 'difficulty'
    | 'block'
    | 'repeat_type'
    | 'sort_order'
  >
}

/**
 * `calendar_events.event_type` 및 로컬 캘린더 — DB 스키마·에이전트와 동일 허용값.
 * 순서: holiday → vacation → travel → birthday → etc → school → special → other → event
 */
export type CalendarEventType =
  | 'holiday'
  | 'vacation'
  | 'travel'
  | 'birthday'
  | 'etc'
  | 'school'
  | 'special'
  | 'other'
  | 'event'

export type CalendarEvent = {
  id: string
  parent_id: string
  child_id: string | null
  title: string
  start_date: string    // YYYY-MM-DD
  end_date: string      // YYYY-MM-DD
  event_type: CalendarEventType
  /** 주중 루틴 강제 / 휴일(주말) 루틴 / 미션 없음 */
  routine_override: 'weekend' | 'none' | 'weekday'
  created_at: string
}

/** localStorage 저장용 캘린더 이벤트 (Supabase 마이그레이션 전) */
export type LocalCalendarEvent = {
  id: string
  childId: string | null  // null = 모든 자녀에 적용
  title: string
  /** 일정에 대한 짧은 메모(구버전 데이터에는 없을 수 있음) */
  description?: string
  startDate: string       // YYYY-MM-DD
  endDate: string         // YYYY-MM-DD
  /** DB `event_type` 과 동일 — holiday·vacation·travel·birthday·etc·school·special·other·event */
  eventType: CalendarEventType
  /** 로컬 캘린더용 — `CalendarEvent` 와 동일한 세 가지 */
  routineOverride: 'weekend' | 'none' | 'weekday'
}

export type MissionLog = {
  id: string
  child_id: string
  mission_id: string
  assigned_date: string
  is_completed: boolean
  completed_at: string | null
  credit_earned: number
  heart_earned: number
  exp_earned: number
  created_at: string
}

export type SavingsGoal = {
  id: string
  child_id: string
  title: string
  target_credits: number
  saved_credits: number
  status: 'active' | 'achieved' | 'cancelled'
  item_image_url: string | null
  achieved_at: string | null
  created_at: string
  updated_at: string
}

/** 부모 메뉴 제어 — 자녀 한 명에게만 다른 마켓 가격을 쓸 때 */
export type ChildStoreItemCreditOverride = {
  child_id: string
  store_item_id: string
  credit_price: number
  updated_at: string
}

export type StoreItem = {
  id: string
  family_link_id: string | null
  name: string
  description: string | null
  image_url: string | null
  credit_price: number
  item_type: 'digital' | 'real'
  category: 'food' | 'toy' | 'activity' | 'digital' | 'experience' | null
  level_required: number
  is_active: boolean
  stock: number | null
  created_at: string
}

export type PurchaseRequest = {
  id: string
  child_id: string
  item_id: string | null
  item_name: string
  item_price: number
  item_type: string
  /** parent_buying: 부모가 외부 쇼핑몰에서 주문 중(자녀에게 별도 안내) */
  status: 'pending' | 'approved' | 'rejected' | 'delivered' | 'parent_buying'
  child_message: string | null
  parent_note: string | null
  requested_at: string
  approved_at: string | null
  delivered_at: string | null
}

export type BadgeRow = {
  id?: string
  badge_id: string
  name: string
  description: string | null
  icon_emoji: string | null
  badge_type: 'level' | 'streak' | 'eq' | 'special'
  condition: Record<string, unknown> | null
}

export type ChildBadge = {
  id: string
  child_id: string
  badge_id: string
  earned_at: string
}

/** 부모가 보낸 칭찬 스티커(한 건 = 판에 한 번 붙일 수 있음) */
export type PraiseStickerGrant = {
  id: string
  child_id: string
  parent_id: string
  sprite_key: string
  created_at: string
  popup_dismissed_at: string | null
}

export type PraiseStickerPlacement = {
  id: string
  grant_id: string
  child_id: string
  x_ratio: number
  y_ratio: number
  scale_ratio: number
  /** 1~20: 곰돌이 판 숫자 칸. null 이면 예전 자유 좌표(x_ratio,y_ratio) */
  board_slot: number | null
  created_at: string
}

// ── 게임 레이어 ────────────────────────────────────────────────

/** 트리거 발동 이력 (중복 방지 gate) */
export type ChildTriggerFired = {
  child_id:    string
  trigger_key: string
  fired_at:    string
}

/** 캐릭터 아이템 잠금 해제 이력 */
export type ChildItemUnlock = {
  id:          string
  child_id:    string
  item_index:  number
  trigger_key: string
  unlocked_at: string
}

/** 공공데이터포털 특일 API 캐시(`public_holidays`) — 달력·루틴 도우미에서 사용 */
export type PublicHoliday = {
  id: string
  year: number
  /** DB 컬럼명 `date` (YYYY-MM-DD) */
  date: string
  name: string
  created_at: string
}
