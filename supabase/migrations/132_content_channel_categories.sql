-- ============================================================
-- 132_content_channel_categories.sql
-- 콘텐츠존 채널을 교육 카테고리로 묶고, 가족 전용(부모 추가) 채널 +
-- 자녀별 채널 숨김을 지원합니다.
-- 비개발자 요약:
--   • content_categories: 운영자가 관리하는 전역 카테고리(자기조절력·파닉스 등)
--   • content_channels: description(소개 문구), category_key, family_link_id 추가
--     - family_link_id 가 null 이면 운영자가 기획한 기본 채널(전 가족 공통)
--     - family_link_id 가 있으면 그 부모가 직접 추가한 가족 전용 채널
--   • content_channel_hidden: 부모가 자녀별로 특정 채널을 숨길 수 있음(기본·가족 전용 공통)
-- ============================================================

-- ── 카테고리 카탈로그(전역) ─────────────────────────────────────
create table if not exists public.content_categories (
  id          uuid primary key default uuid_generate_v4(),
  key         text not null unique,
  label       text not null,
  order_index int not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.content_categories is
  '콘텐츠존 채널을 묶는 교육 카테고리(운영자 관리, 전 가족 공통).';

create index if not exists idx_content_categories_order
  on public.content_categories (order_index asc);

alter table public.content_categories enable row level security;

drop policy if exists "content_categories_authenticated_select" on public.content_categories;
create policy "content_categories_authenticated_select"
  on public.content_categories
  for select
  using (auth.role() = 'authenticated');

grant select on table public.content_categories to authenticated;

insert into public.content_categories (key, label, order_index)
select v.key, v.label, v.order_index
from (
  values
    ('story', '동화', 1),
    ('english', '영어', 2),
    ('korean', '한글', 3),
    ('self_regulation', '자기조절력', 4),
    ('phonics', '파닉스·사이트워드', 5),
    ('kindness_teamwork', '배려심·협동심', 6),
    ('reasoning', '추론력', 7),
    ('math_science', '미국 교과 수학·과학', 8),
    ('award_shorts', '오스카 단편 수상작', 9),
    ('etc', '기타', 99)
) as v(key, label, order_index)
where not exists (
  select 1 from public.content_categories c where c.key = v.key
);

-- ── content_channels 확장 ────────────────────────────────────
alter table public.content_channels
  add column if not exists description text,
  add column if not exists category_key text,
  add column if not exists family_link_id uuid references public.family_links (id) on delete cascade;

create index if not exists idx_content_channels_family
  on public.content_channels (family_link_id);

create index if not exists idx_content_channels_category_key
  on public.content_channels (category_key);

-- 기존 자유 텍스트 category → category_key 로 매핑(없으면 기타)
update public.content_channels
set category_key = case category
  when '동화' then 'story'
  when '영어' then 'english'
  when '한글' then 'korean'
  else 'etc'
end
where category_key is null;

alter table public.content_channels alter column category_key set default 'etc';
alter table public.content_channels alter column category_key set not null;

-- ── RLS: 조회는 전체 인증 사용자, 쓰기는 가족 전용 행의 소유 부모만 ─────
drop policy if exists "content_channels_authenticated_select" on public.content_channels;
create policy "content_channels_select"
  on public.content_channels
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "content_channels_parent_insert_own_family_link" on public.content_channels;
create policy "content_channels_parent_insert_own_family_link"
  on public.content_channels
  for insert
  to authenticated
  with check (
    family_link_id is not null
    and exists (
      select 1 from public.family_links fl
      where fl.id = content_channels.family_link_id and fl.parent_id = auth.uid()
    )
  );

drop policy if exists "content_channels_parent_update_own_family_link" on public.content_channels;
create policy "content_channels_parent_update_own_family_link"
  on public.content_channels
  for update
  to authenticated
  using (
    family_link_id is not null
    and exists (
      select 1 from public.family_links fl
      where fl.id = content_channels.family_link_id and fl.parent_id = auth.uid()
    )
  )
  with check (
    family_link_id is not null
    and exists (
      select 1 from public.family_links fl
      where fl.id = content_channels.family_link_id and fl.parent_id = auth.uid()
    )
  );

drop policy if exists "content_channels_parent_delete_own_family_link" on public.content_channels;
create policy "content_channels_parent_delete_own_family_link"
  on public.content_channels
  for delete
  to authenticated
  using (
    family_link_id is not null
    and exists (
      select 1 from public.family_links fl
      where fl.id = content_channels.family_link_id and fl.parent_id = auth.uid()
    )
  );

grant insert, update, delete on table public.content_channels to authenticated;

-- ── 자녀별 채널 숨김 ──────────────────────────────────────────
create table if not exists public.content_channel_hidden (
  child_id   uuid not null references public.profiles (id) on delete cascade,
  channel_id uuid not null references public.content_channels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (child_id, channel_id)
);

comment on table public.content_channel_hidden is
  '부모가 자녀 콘텐츠존에서 숨긴 채널. 행 존재 = 자녀 화면에 비표시(기본·가족 전용 채널 공통).';

create index if not exists idx_content_channel_hidden_child
  on public.content_channel_hidden (child_id);

alter table public.content_channel_hidden enable row level security;

drop policy if exists "content_channel_hidden_child_select" on public.content_channel_hidden;
create policy "content_channel_hidden_child_select"
  on public.content_channel_hidden
  for select
  using (auth.uid() = child_id);

drop policy if exists "content_channel_hidden_parent_all" on public.content_channel_hidden;
create policy "content_channel_hidden_parent_all"
  on public.content_channel_hidden
  for all
  using (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = content_channel_hidden.child_id
    )
  )
  with check (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = content_channel_hidden.child_id
    )
  );

grant select, insert, delete on table public.content_channel_hidden to authenticated;
