-- 022 를 대시보드에서 수동 실행했을 때 실패·중복 대비: 정책을 한 번 지우고 다시 만듭니다.
-- (이미 022 가 성공했다면 이 파일만 적용해도 동일한 정책이 됩니다.)

drop policy if exists "missions_parent_insert" on public.missions;

create policy "missions_parent_insert"
  on public.missions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'parent'
    )
  );
