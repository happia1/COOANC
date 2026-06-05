-- ============================================================
-- 115_plant_seed_purchases_parent_rls.sql
-- 부모가 연결된 자녀의 씨앗 구매 이력을 읽을 수 있게 합니다.
-- (자녀 화면 미리보기·재로그인 시 hasChosenSeed 판별용)
-- ============================================================

drop policy if exists "parent_linked_child_purchases_select" on public.plant_seed_purchases;

create policy "parent_linked_child_purchases_select"
  on public.plant_seed_purchases
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.family_links
      where parent_id = auth.uid()
        and child_id = plant_seed_purchases.child_id
    )
  );

drop policy if exists "parent_linked_child_purchases_insert" on public.plant_seed_purchases;

create policy "parent_linked_child_purchases_insert"
  on public.plant_seed_purchases
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.family_links
      where parent_id = auth.uid()
        and child_id = plant_seed_purchases.child_id
    )
  );
