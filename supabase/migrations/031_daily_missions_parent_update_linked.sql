-- 부모가 family_links 로 연결된 자녀의 daily_missions 를 업데이트할 수 있게 함
-- (부모 계정으로 자녀 미션 화면을 열고 완료 처리할 때 필요)

drop policy if exists "parent_update_child_daily_missions" on public.daily_missions;

create policy "parent_update_child_daily_missions" on public.daily_missions
  for update
  using (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = daily_missions.child_id
    )
  )
  with check (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = daily_missions.child_id
    )
  );

notify pgrst, 'reload schema';
