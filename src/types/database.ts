/**
 * Supabase 테이블 Row 타입 정의
 * DB 스키마 변경 시 이 파일을 함께 업데이트하세요.
 */

export type UserRole = 'parent' | 'child'

export type Profile = {
  id: string
  role: UserRole
  name: string
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
  concept_tag: '미션' | '교환' | '저축' | '나눔' | '투자' | '도전' | '학습' | '기여' | '건강' | '습관' | null
  difficulty: 'easy' | 'normal' | 'hard' | 'special'
  repeat_type: 'daily' | 'weekly' | 'monthly' | 'event'
  is_active: boolean
  created_at: string
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
  status: 'pending' | 'approved' | 'rejected' | 'delivered'
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
