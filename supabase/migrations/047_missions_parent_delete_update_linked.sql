-- ============================================================
-- 047_missions_parent_delete_update_linked.sql
-- 키워드 루틴 재저장 시 기존 템플릿 삭제(/api/mission/delete-keyword-routine)와
-- 보상 PATCH(/api/mission/patch-rewards)가 RLS 없이 실패하지 않도록,
-- 연결된 자녀 전용 미션(linked_child_id)만 부모가 삭제·수정할 수 있게 합니다.
-- ============================================================

drop policy if exists "missions_parent_delete_linked_child" on public.missions;
create policy "missions_parent_delete_linked_child"
  on public.missions
  for delete
  to authenticated
  using (
    linked_child_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'parent'
    )
    and exists (
      select 1
      from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = missions.linked_child_id
    )
  );

drop policy if exists "missions_parent_update_linked_child" on public.missions;
create policy "missions_parent_update_linked_child"
  on public.missions
  for update
  to authenticated
  using (
    linked_child_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'parent'
    )
    and exists (
      select 1
      from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = missions.linked_child_id
    )
  )
  with check (
    linked_child_id is not null
    and exists (
      select 1
      from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = missions.linked_child_id
    )
  );

comment on policy "missions_parent_delete_linked_child" on public.missions is
  '부모가 family_links 로 연결된 자녀의 전용 미션 템플릿만 삭제(키워드 루틴 재구성 등)';

comment on policy "missions_parent_update_linked_child" on public.missions is
  '부모가 연결 자녀 전용 미션의 필드(보상 등)만 수정';

notify pgrst, 'reload schema';
