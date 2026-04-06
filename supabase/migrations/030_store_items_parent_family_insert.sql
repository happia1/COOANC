-- 부모가 연결된 자녀용 가족 전용 마켓 상품(store_items)을 등록할 수 있게 합니다.
-- family_link_id 가 본인 부모-자녀 연결 행을 가리킬 때만 INSERT 허용.

create policy "store_items_parent_insert_own_family_link"
  on public.store_items
  for insert
  to authenticated
  with check (
    family_link_id is not null
    and exists (
      select 1
      from public.family_links fl
      where fl.id = store_items.family_link_id
        and fl.parent_id = auth.uid()
    )
  );
