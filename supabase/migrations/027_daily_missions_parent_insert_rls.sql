-- 부모가 연결된 자녀의 daily_missions 에 행을 넣을 수 있게 함
-- (POST /api/daily-mission/assign-today — service_role 키가 없는 로컬·스테이징에서도 동작)
-- 기존: child 본인만 insert, parent 는 select 만 가능 → 부모 배정 시 RLS 로 500

drop policy if exists "parent_insert_child_daily_missions" on public.daily_missions;

create policy "parent_insert_child_daily_missions"
  on public.daily_missions
  for insert
  with check (
    exists (
      select 1
      from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = child_id
    )
  );
