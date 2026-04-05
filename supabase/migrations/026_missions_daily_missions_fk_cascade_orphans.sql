-- ============================================================
-- 고아 미션·일일미션 정리 + missions / daily_missions / mission_logs FK CASCADE 보강
-- 실제 테이블: public.profiles, public.missions, public.daily_missions, public.mission_logs
-- 목록 확인: scripts/sql/list_public_tables.sql
-- ============================================================

-- 제약 이름이 인스턴스마다 다를 수 있어, 정의 문자열로 찾아 DROP 후 CASCADE 로 재생성합니다.

-- ── A. mission_logs.mission_id → missions(id) ON DELETE CASCADE
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'mission_logs'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) ilike '%mission_id%'
      and pg_get_constraintdef(c.oid) ilike '%missions%'
  loop
    execute format('alter table public.mission_logs drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.mission_logs
  add constraint mission_logs_mission_id_fkey
  foreign key (mission_id) references public.missions(id) on delete cascade;

-- ── B. daily_missions: child_id, mission_template_id → CASCADE
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'daily_missions'
      and c.contype = 'f'
  loop
    execute format('alter table public.daily_missions drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.daily_missions
  add constraint daily_missions_child_id_fkey
  foreign key (child_id) references public.profiles(id) on delete cascade;

alter table public.daily_missions
  add constraint daily_missions_mission_template_id_fkey
  foreign key (mission_template_id) references public.missions(id) on delete cascade;

-- ── C. 고아 행 삭제 (프로필 없는 child / 없는 자녀를 가리키는 linked_child_id)
delete from public.daily_missions dm
where not exists (select 1 from public.profiles p where p.id = dm.child_id);

delete from public.missions m
where m.linked_child_id is not null
  and not exists (select 1 from public.profiles p where p.id = m.linked_child_id);

-- ── D. missions.linked_child_id → profiles(id) ON DELETE CASCADE
alter table public.missions drop constraint if exists missions_linked_child_id_fkey;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'missions'
      and column_name = 'linked_child_id'
  ) then
    alter table public.missions
      add constraint missions_linked_child_id_fkey
      foreign key (linked_child_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

comment on constraint mission_logs_mission_id_fkey on public.mission_logs is '미션 템플릿 삭제 시 로그 행 CASCADE 삭제';
