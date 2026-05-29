-- ============================================================
-- 091_store_items_parent_update_delete_own_family.sql
-- 부모가 자신이 만든 가족 전용 상품(store_items.family_link_id not null)만
-- 수정/삭제할 수 있도록 정책을 추가합니다.
-- ============================================================

create policy "store_items_parent_update_own_family_link"
  on public.store_items
  for update
  to authenticated
  using (
    family_link_id is not null
    and exists (
      select 1
      from public.family_links fl
      where fl.id = store_items.family_link_id
        and fl.parent_id = auth.uid()
    )
  )
  with check (
    family_link_id is not null
    and exists (
      select 1
      from public.family_links fl
      where fl.id = store_items.family_link_id
        and fl.parent_id = auth.uid()
    )
  );

create policy "store_items_parent_delete_own_family_link"
  on public.store_items
  for delete
  to authenticated
  using (
    family_link_id is not null
    and exists (
      select 1
      from public.family_links fl
      where fl.id = store_items.family_link_id
        and fl.parent_id = auth.uid()
    )
  );
