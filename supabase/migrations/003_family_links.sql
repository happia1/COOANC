-- ============================================================
-- 003_family_links.sql
-- 부모-자녀 가족 연결 테이블
-- ============================================================

create table if not exists family_links (
  id          uuid primary key default uuid_generate_v4(),
  parent_id   uuid not null references profiles(id) on delete cascade,
  child_id    uuid not null references profiles(id) on delete cascade,
  nickname    text,
  created_at  timestamptz default now(),
  unique (parent_id, child_id)
);
