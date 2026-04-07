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
  eq_delay_score: number        // 만족 지연 지수 0~100
  eq_routine_rate: number       // 루틴 완주율 0~100
  eq_save_ratio: number         // 저축 비중 0~100
  streak_days: number
  last_mission_date: string | null
  longest_streak: number
  promotion_pending: boolean
  promotion_eligible_at: string | null
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
  >
}

export type CalendarEvent = {
  id: string
  parent_id: string
  child_id: string | null
  title: string
  start_date: string    // YYYY-MM-DD
  end_date: string      // YYYY-MM-DD
  event_type: 'holiday' | 'vacation' | 'special' | 'other'
  routine_override: 'weekend' | 'none'
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
  eventType: 'holiday' | 'vacation' | 'special' | 'other'
  routineOverride: 'weekend' | 'none'
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
