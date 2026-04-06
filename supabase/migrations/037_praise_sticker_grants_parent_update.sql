-- 부모가 자녀 화면 미리보기 중일 때 popup_dismissed_at 갱신이 필요합니다.
-- 기존 child_update 는 auth.uid() = child_id 만 허용해 부모 세션에서는 UPDATE 가 항상 거절됩니다.

drop policy if exists "praise_sticker_grants_parent_update_linked" on public.praise_sticker_grants;

create policy "praise_sticker_grants_parent_update_linked"
  on public.praise_sticker_grants for update
  using (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = praise_sticker_grants.child_id
    )
  )
  with check (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = praise_sticker_grants.child_id
    )
  );
