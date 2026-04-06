-- ============================================================================
-- Supabase 대시보드 → SQL Editor 에 붙여넣어 한 번에 실행하세요.
-- (마이그레이션 CLI 없이 원격 프로젝트에 칭찬 스티커 테이블·RLS·권한을 만듭니다.)
-- 이미 일부만 적용된 경우에도 정책은 DROP 후 다시 만들므로 재실행에 강합니다.
-- ============================================================================

-- ----- 033: 테이블 -----
create table if not exists public.praise_sticker_grants (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  sprite_key text not null,
  created_at timestamptz not null default now(),
  popup_dismissed_at timestamptz null
);

create index if not exists praise_sticker_grants_child_id_idx
  on public.praise_sticker_grants (child_id);

create table if not exists public.praise_sticker_placements (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.praise_sticker_grants (id) on delete cascade,
  child_id uuid not null references public.profiles (id) on delete cascade,
  x_ratio double precision not null,
  y_ratio double precision not null,
  scale_ratio double precision not null default 1,
  created_at timestamptz not null default now(),
  constraint praise_sticker_placements_ratio_x check (x_ratio >= 0 and x_ratio <= 1),
  constraint praise_sticker_placements_ratio_y check (y_ratio >= 0 and y_ratio <= 1),
  constraint praise_sticker_placements_scale check (scale_ratio > 0 and scale_ratio <= 3),
  constraint praise_sticker_placements_grant_unique unique (grant_id)
);

create index if not exists praise_sticker_placements_child_id_idx
  on public.praise_sticker_placements (child_id);

alter table public.praise_sticker_grants enable row level security;
alter table public.praise_sticker_placements enable row level security;

drop policy if exists "praise_sticker_grants_select" on public.praise_sticker_grants;
create policy "praise_sticker_grants_select"
  on public.praise_sticker_grants for select
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = praise_sticker_grants.child_id
    )
  );

drop policy if exists "praise_sticker_grants_parent_insert" on public.praise_sticker_grants;
create policy "praise_sticker_grants_parent_insert"
  on public.praise_sticker_grants for insert
  with check (
    auth.uid() = parent_id
    and exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = praise_sticker_grants.child_id
    )
  );

drop policy if exists "praise_sticker_grants_child_update" on public.praise_sticker_grants;
create policy "praise_sticker_grants_child_update"
  on public.praise_sticker_grants for update
  using (auth.uid() = child_id)
  with check (auth.uid() = child_id);

drop policy if exists "praise_sticker_placements_select" on public.praise_sticker_placements;
create policy "praise_sticker_placements_select"
  on public.praise_sticker_placements for select
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = praise_sticker_placements.child_id
    )
  );

drop policy if exists "praise_sticker_placements_child_insert" on public.praise_sticker_placements;
create policy "praise_sticker_placements_child_insert"
  on public.praise_sticker_placements for insert
  with check (
    auth.uid() = child_id
    and exists (
      select 1 from public.praise_sticker_grants g
      where g.id = grant_id and g.child_id = auth.uid()
    )
  );

-- ----- 034: 곰돌이 판 슬롯 -----
alter table public.praise_sticker_placements
  add column if not exists board_slot smallint null;

alter table public.praise_sticker_placements
  drop constraint if exists praise_sticker_placements_board_slot_range;

alter table public.praise_sticker_placements
  add constraint praise_sticker_placements_board_slot_range
  check (board_slot is null or (board_slot >= 1 and board_slot <= 20));

drop index if exists public.praise_sticker_placements_child_slot_uidx;

create unique index praise_sticker_placements_child_slot_uidx
  on public.praise_sticker_placements (child_id, board_slot)
  where board_slot is not null;

-- ----- 035: API(authenticated) 권한 + realtime(중복 없이) -----
grant select, insert on table public.praise_sticker_grants to authenticated;
grant select, insert, update on table public.praise_sticker_placements to authenticated;

do $body$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'praise_sticker_grants'
  ) then
    alter publication supabase_realtime add table public.praise_sticker_grants;
  end if;
end
$body$;

-- ----- 036: 부모 자녀화면 미리보기 시 스티커 판 INSERT (선택 적용) -----
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

-- ----- 037: 부모 미리보기에서 도착 팝업 확인(popup_dismissed_at) UPDATE -----
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
