-- ============================================================
-- public.daily_missions 가 없을 때( to_regclass → NULL ) 한 번에 복구
-- Supabase SQL Editor 에 붙여 넣어 실행해도 되고, supabase db push 로도 적용됩니다.
-- (파일명이 20240406_daily_missions 보다 뒤라, 기존 마이그레이션 순서와 충돌하지 않습니다.)
-- profiles·missions·family_links 가 이미 있어야 합니다.
-- ============================================================

create table if not exists public.daily_missions (
  id                  uuid        primary key default gen_random_uuid(),
  child_id            uuid        not null references public.profiles(id) on delete cascade,
  mission_template_id uuid        not null references public.missions(id) on delete cascade,
  date                date        not null,
  scheduled_time      time,
  routine_type        text        check (routine_type in ('weekday','weekend','holiday','vacation')),
  is_completed        boolean     not null default false,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  unique(child_id, mission_template_id, date)
);

create index if not exists idx_daily_missions_child_date
  on public.daily_missions(child_id, date);

alter table public.daily_missions enable row level security;

-- 정책 이름 고정 → 재실행 시 깨끗이 교체
drop policy if exists "child_select_own_daily_missions" on public.daily_missions;
drop policy if exists "child_update_own_daily_missions" on public.daily_missions;
drop policy if exists "child_insert_own_daily_missions" on public.daily_missions;
drop policy if exists "parent_select_child_daily_missions" on public.daily_missions;
drop policy if exists "parent_insert_child_daily_missions" on public.daily_missions;
drop policy if exists "service_all_daily_missions" on public.daily_missions;

create policy "child_select_own_daily_missions" on public.daily_missions
  for select using (auth.uid() = child_id);

create policy "child_update_own_daily_missions" on public.daily_missions
  for update using (auth.uid() = child_id)
  with check (auth.uid() = child_id);

create policy "child_insert_own_daily_missions" on public.daily_missions
  for insert with check (auth.uid() = child_id);

create policy "parent_select_child_daily_missions" on public.daily_missions
  for select using (
    exists (
      select 1 from public.family_links
      where parent_id = auth.uid()
        and child_id = daily_missions.child_id
    )
  );

-- 부모가 연결된 자녀의 오늘 일정 행 추가 (assign-today)
create policy "parent_insert_child_daily_missions" on public.daily_missions
  for insert
  with check (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = child_id
    )
  );

create policy "service_all_daily_missions" on public.daily_missions
  for all using ((auth.jwt() ->> 'role') = 'service_role');

-- PostgREST 가 새 테이블을 바로 스키마 캐시에 반영하도록 알림 (PGRST205 완화)
notify pgrst, 'reload schema';
