-- 칭찬 스티커: 부모가 보낸 디지털 스티커 + 자녀 곰돌이 판 배치
-- animations.json(sticker_board, tag, reward, message 등)의 sprite_key 문자열을 저장합니다.

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

-- 조회: 자녀 본인 또는 연결된 부모
create policy "praise_sticker_grants_select"
  on public.praise_sticker_grants for select
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = praise_sticker_grants.child_id
    )
  );

-- 부모만 지급(INSERT)
create policy "praise_sticker_grants_parent_insert"
  on public.praise_sticker_grants for insert
  with check (
    auth.uid() = parent_id
    and exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = praise_sticker_grants.child_id
    )
  );

-- 자녀: 도착 팝업 확인(popup_dismissed_at)만 갱신
create policy "praise_sticker_grants_child_update"
  on public.praise_sticker_grants for update
  using (auth.uid() = child_id)
  with check (auth.uid() = child_id);

create policy "praise_sticker_placements_select"
  on public.praise_sticker_placements for select
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = praise_sticker_placements.child_id
    )
  );

-- 자녀만 판에 붙이기
create policy "praise_sticker_placements_child_insert"
  on public.praise_sticker_placements for insert
  with check (
    auth.uid() = child_id
    and exists (
      select 1 from public.praise_sticker_grants g
      where g.id = grant_id and g.child_id = auth.uid()
    )
  );

-- 실시간 도착 알림용
alter publication supabase_realtime add table public.praise_sticker_grants;
