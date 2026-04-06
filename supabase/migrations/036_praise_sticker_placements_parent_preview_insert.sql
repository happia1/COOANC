-- 부모가 자녀 화면 미리보기(부모 세션 + 자녀 actorChildId)로 곰돌이 판에 스티커를 붙일 때 INSERT 가 필요합니다.
-- 기존 정책은 auth.uid() = child_id 만 허용해 부모 UID 로는 항상 거절됩니다.

drop policy if exists "praise_sticker_placements_parent_preview_insert" on public.praise_sticker_placements;

create policy "praise_sticker_placements_parent_preview_insert"
  on public.praise_sticker_placements for insert
  with check (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = praise_sticker_placements.child_id
    )
    and exists (
      select 1 from public.praise_sticker_grants g
      where g.id = grant_id and g.child_id = praise_sticker_placements.child_id
    )
  );
