-- ============================================================
-- 048_mission_logs_mission_id_on_delete_cascade.sql
-- 키워드 루틴 재저장 시 missions 행을 지울 때 mission_logs 가
-- 같은 mission_id 를 참조하면 FK 23503 으로 삭제가 막힙니다.
-- mission_id → missions(id) 를 ON DELETE CASCADE 로 맞춥니다.
-- (026 과 동일한 A 절 — 일부 환경에서 026 미적용·제약 이름 불일치 대비 재적용)
-- ============================================================

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

comment on constraint mission_logs_mission_id_fkey on public.mission_logs is
  '미션 템플릿 삭제 시 해당 로그 행도 함께 제거(키워드 루틴 재구성 등)';

notify pgrst, 'reload schema';
