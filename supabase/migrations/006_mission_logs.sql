-- ============================================================
-- 006_mission_logs.sql
-- 미션 수행 로그 테이블 + 인덱스
-- (Realtime 구독 대상 테이블)
-- ============================================================

create table if not exists mission_logs (
  id              uuid primary key default uuid_generate_v4(),
  child_id        uuid not null references profiles(id) on delete cascade,
  mission_id      uuid not null references missions(id),
  assigned_date   date not null default current_date,
  is_completed    boolean default false,
  completed_at    timestamptz,
  credit_earned   int default 0,
  heart_earned    int default 0,
  exp_earned      int default 0,
  created_at      timestamptz default now(),
  unique (child_id, mission_id, assigned_date)
);

create index if not exists idx_mission_logs_child_date
  on mission_logs (child_id, assigned_date desc);

create index if not exists idx_mission_logs_child_completed
  on mission_logs (child_id, is_completed, assigned_date desc);
