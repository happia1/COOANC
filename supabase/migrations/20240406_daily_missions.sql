-- ============================================================
-- COOANC — 데일리 미션 + 캘린더 이벤트 스키마
-- 실행 환경: Supabase SQL Editor
-- ============================================================

-- 1. missions 테이블에 block 컬럼 추가
alter table missions
  add column if not exists block text
    check (block in ('morning','afternoon','evening','bedtime'));

-- 2. profiles 테이블에 자녀 전용 컬럼 추가
alter table profiles
  add column if not exists age_group text
    check (age_group in ('preschool','school')),
  add column if not exists institution_type text
    check (institution_type in ('home','daycare','kindergarten','school')),
  add column if not exists academies jsonb default '[]'::jsonb,
  add column if not exists wake_time time,
  add column if not exists sleep_time time,
  add column if not exists alarm_enabled boolean default false;

-- 3. daily_missions 테이블 생성
create table if not exists daily_missions (
  id                  uuid        primary key default gen_random_uuid(),
  child_id            uuid        not null references profiles(id) on delete cascade,
  mission_template_id uuid        not null references missions(id)  on delete cascade,
  date                date        not null,
  scheduled_time      time,
  routine_type        text        check (routine_type in ('weekday','weekend','holiday','vacation')),
  is_completed        boolean     not null default false,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  unique(child_id, mission_template_id, date)
);

-- 4. calendar_events 테이블 생성
create table if not exists calendar_events (
  id               uuid        primary key default gen_random_uuid(),
  parent_id        uuid        not null references profiles(id) on delete cascade,
  child_id         uuid        references profiles(id) on delete cascade,
  title            text        not null,
  start_date       date        not null,
  end_date         date        not null,
  event_type       text        check (event_type in ('holiday','vacation','special')),
  routine_override text        not null check (routine_override in ('weekend','none')) default 'weekend',
  created_at       timestamptz not null default now()
);

-- ============================================================
-- RLS — daily_missions
-- ============================================================
alter table daily_missions enable row level security;

-- 자녀 본인: 자신의 daily_missions 조회 + 완료 상태 업데이트
create policy "child_select_own_daily_missions" on daily_missions
  for select using (auth.uid() = child_id);

create policy "child_update_own_daily_missions" on daily_missions
  for update using (auth.uid() = child_id)
  with check (auth.uid() = child_id);

-- 자녀 본인: INSERT (auto-generate fallback 용)
create policy "child_insert_own_daily_missions" on daily_missions
  for insert with check (auth.uid() = child_id);

-- 부모: family_links로 연결된 자녀의 daily_missions 조회
create policy "parent_select_child_daily_missions" on daily_missions
  for select using (
    exists (
      select 1 from family_links
      where parent_id = auth.uid()
        and child_id  = daily_missions.child_id
    )
  );

-- service_role (Edge Function, Admin): 전체 접근
create policy "service_all_daily_missions" on daily_missions
  for all using ((auth.jwt() ->> 'role') = 'service_role');

-- ============================================================
-- RLS — calendar_events
-- ============================================================
alter table calendar_events enable row level security;

-- 부모 본인: 자신의 캘린더 이벤트 전체 관리
create policy "parent_all_calendar_events" on calendar_events
  for all using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

-- ============================================================
-- Index
-- ============================================================
create index if not exists idx_daily_missions_child_date
  on daily_missions(child_id, date);

create index if not exists idx_calendar_events_parent_date
  on calendar_events(parent_id, start_date, end_date);
