-- ============================================================
-- 004_child_stats.sql
-- 자녀 경제 프로필 (크레딧, EXP, 레벨, EQ 지수 등)
-- NOTE: credits 증감은 반드시 DB 트리거로만 처리 (프론트 직접 조작 금지)
-- ============================================================

create table if not exists child_stats (
  id                    uuid primary key default uuid_generate_v4(),
  child_id              uuid unique not null references profiles(id) on delete cascade,
  credits               int not null default 0 check (credits >= 0),
  hearts                int not null default 0 check (hearts >= 0),
  total_credits_earned  int not null default 0,
  current_level         int not null default 0 check (current_level between 0 and 5),
  exp                   int not null default 0,
  exp_to_next_level     int not null default 100,
  eq_delay_score        int not null default 0,   -- 만족 지연 지수 (0~100)
  eq_routine_rate       int not null default 0,   -- 루틴 완주율 (0~100)
  eq_save_ratio         int not null default 0,   -- 소비 vs 저축 비중 (0~100)
  streak_days           int not null default 0,
  last_mission_date     date,
  longest_streak        int not null default 0,
  promotion_pending     boolean default false,
  promotion_eligible_at timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);
