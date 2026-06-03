-- ============================================================
-- 008_savings_goals.sql
-- 저금통 목표 테이블 (v3: 저축왕=Lv.5·저금통 해금; 구 Lv.3 서사와 무관)
-- ============================================================

create table if not exists savings_goals (
  id              uuid primary key default uuid_generate_v4(),
  child_id        uuid not null references profiles(id) on delete cascade,
  title           text not null,
  target_credits  int not null check (target_credits > 0),
  saved_credits   int not null default 0 check (saved_credits >= 0),
  status          text not null default 'active'
                    check (status in ('active', 'achieved', 'cancelled')),
  item_image_url  text,
  achieved_at     timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
