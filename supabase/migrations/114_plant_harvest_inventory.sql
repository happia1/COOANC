-- ============================================================
-- 114_plant_harvest_inventory.sql
-- 수확한 과일 보관 (추후 판매·크레딧 전환용)
-- ============================================================

create table if not exists public.plant_harvest_inventory (
  child_id   uuid not null references public.profiles(id) on delete cascade,
  fruit_id   text not null,
  quantity   int not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (child_id, fruit_id)
);

create index if not exists plant_harvest_inventory_child_idx
  on public.plant_harvest_inventory (child_id);

alter table public.plant_harvest_inventory enable row level security;

drop policy if exists "child_own_harvest_inventory" on public.plant_harvest_inventory;
create policy "child_own_harvest_inventory"
  on public.plant_harvest_inventory
  for all
  to authenticated
  using (child_id = auth.uid())
  with check (child_id = auth.uid());

drop policy if exists "parent_linked_harvest_inventory" on public.plant_harvest_inventory;
create policy "parent_linked_harvest_inventory"
  on public.plant_harvest_inventory
  for all
  to authenticated
  using (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = plant_harvest_inventory.child_id
    )
  )
  with check (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = plant_harvest_inventory.child_id
    )
  );

grant select, insert, update on public.plant_harvest_inventory to authenticated;
