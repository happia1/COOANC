-- ============================================================
-- 096_content_zone.sql
-- 콘텐츠존(이용권·채널·시청 세션) 테이블 + 마켓 상품 + RLS
-- 비개발자 요약:
--   • content_channels: 유튜브 채널/플레이리스트 목록(전 아이 공통)
--   • content_tickets: 자녀별 보유 이용권 수
--   • content_sessions: 30분 시청 세션 기록
--   • 마켓 「콘텐츠 이용권 30분」 구매 시 이용권 +1
-- ============================================================

-- ── 채널 카탈로그 ─────────────────────────────────────────────
create table if not exists public.content_channels (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  thumbnail_url text,
  playlist_url  text not null,
  category      text not null,
  order_index   int not null default 0,
  created_at    timestamptz not null default now()
);

comment on table public.content_channels is
  '콘텐츠존 유튜브 채널·플레이리스트 카탈로그(전역).';

create index if not exists idx_content_channels_order
  on public.content_channels (order_index asc);

alter table public.content_channels enable row level security;

create policy "content_channels_authenticated_select"
  on public.content_channels
  for select
  using (auth.role() = 'authenticated');

grant select on table public.content_channels to authenticated;

-- ── 자녀별 이용권 ─────────────────────────────────────────────
create table if not exists public.content_tickets (
  id         uuid primary key default uuid_generate_v4(),
  child_id   uuid not null references public.profiles (id) on delete cascade,
  quantity   int not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (child_id)
);

comment on table public.content_tickets is
  '자녀별 콘텐츠 이용권 보유 수.';

create index if not exists idx_content_tickets_child
  on public.content_tickets (child_id);

alter table public.content_tickets enable row level security;

create policy "content_tickets_child_access"
  on public.content_tickets
  for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = content_tickets.child_id
    )
  )
  with check (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = content_tickets.child_id
    )
  );

grant select, insert, update on table public.content_tickets to authenticated;

-- ── 시청 세션 ─────────────────────────────────────────────────
create table if not exists public.content_sessions (
  id               uuid primary key default uuid_generate_v4(),
  child_id         uuid not null references public.profiles (id) on delete cascade,
  started_at       timestamptz not null default now(),
  duration_minutes int not null default 30 check (duration_minutes > 0),
  is_active        boolean not null default true,
  playlist_url     text,
  created_at       timestamptz not null default now()
);

comment on table public.content_sessions is
  '콘텐츠 이용권 사용 후 30분 시청 세션.';

create index if not exists idx_content_sessions_child_active
  on public.content_sessions (child_id, is_active, started_at desc);

alter table public.content_sessions enable row level security;

create policy "content_sessions_child_access"
  on public.content_sessions
  for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = content_sessions.child_id
    )
  )
  with check (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = content_sessions.child_id
    )
  );

grant select, insert, update on table public.content_sessions to authenticated;

-- ── 이용권 지급 RPC (마켓 구매 완료 시) ───────────────────────
create or replace function public.grant_content_ticket(p_child_id uuid, p_amount int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;

  insert into public.content_tickets (child_id, quantity, updated_at)
  values (p_child_id, p_amount, now())
  on conflict (child_id) do update
    set quantity = public.content_tickets.quantity + p_amount,
        updated_at = now()
  returning quantity into v_qty;

  return v_qty;
end;
$$;

comment on function public.grant_content_ticket(uuid, int) is
  '자녀에게 콘텐츠 이용권을 지급합니다(upsert).';

grant execute on function public.grant_content_ticket(uuid, int) to authenticated;

drop function if exists public.start_content_session(uuid, int);

-- ── 이용권 차감 + 세션 시작 RPC (원자적) ───────────────────────
create or replace function public.start_content_session(
  p_child_id uuid,
  p_duration_minutes int default 30,
  p_playlist_url text default null
)
returns table(session_id uuid, remaining_quantity int, started_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty int;
  v_session_id uuid;
  v_started timestamptz := now();
begin
  if auth.uid() is distinct from p_child_id
     and not exists (
       select 1 from public.family_links fl
       where fl.parent_id = auth.uid() and fl.child_id = p_child_id
     ) then
    raise exception 'forbidden';
  end if;

  select ct.quantity into v_qty
  from public.content_tickets ct
  where ct.child_id = p_child_id
  for update;

  if v_qty is null or v_qty < 1 then
    raise exception 'no tickets';
  end if;

  update public.content_tickets
  set quantity = quantity - 1, updated_at = now()
  where child_id = p_child_id
  returning quantity into v_qty;

  insert into public.content_sessions (child_id, started_at, duration_minutes, is_active, playlist_url)
  values (p_child_id, v_started, coalesce(p_duration_minutes, 30), true, p_playlist_url)
  returning id into v_session_id;

  session_id := v_session_id;
  remaining_quantity := v_qty;
  started_at := v_started;
  return next;
end;
$$;

comment on function public.start_content_session(uuid, int, text) is
  '이용권 1개를 차감하고 시청 세션을 시작합니다.';

grant execute on function public.start_content_session(uuid, int, text) to authenticated;

-- ── 세션 종료 RPC ─────────────────────────────────────────────
create or replace function public.end_content_session(p_session_id uuid, p_child_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_child_id
     and not exists (
       select 1 from public.family_links fl
       where fl.parent_id = auth.uid() and fl.child_id = p_child_id
     ) then
    raise exception 'forbidden';
  end if;

  update public.content_sessions
  set is_active = false
  where id = p_session_id
    and child_id = p_child_id
    and is_active = true;

  return found;
end;
$$;

grant execute on function public.end_content_session(uuid, uuid) to authenticated;

-- ── 초기 채널 데이터 ───────────────────────────────────────────
insert into public.content_channels (title, playlist_url, category, order_index)
select v.title, v.playlist_url, v.category, v.order_index
from (
  values
    ('페파피그 한글/영어', 'https://www.youtube.com/@PeppaPigKoreanOfficial', '동화', 1),
    ('마샤앤베어 영어', 'https://www.youtube.com/playlist?list=PL-yqdhzdKqQRAm93SDGOtPK8KIe2QZQTO', '영어', 2),
    ('마샤와곰 한글', 'https://www.youtube.com/playlist?list=PLTX2eKRvZ_AOAQr6dJkm10inasoXkca9L', '한글', 3),
    ('핑크퐁 뮤지컬 명작동화', 'https://www.youtube.com/playlist?list=PLmytdODiM353yS-PD3JQ-tMyz9bHXueSu', '동화', 4),
    ('핑크퐁 인기동요동화', 'https://www.youtube.com/playlist?list=PLhzBuObIigYMakhvVSVdEWFs8BAjAlfkK', '동화', 5),
    ('너울나비 동화존', 'https://www.youtube.com/playlist?list=PLyCo9nr0e8FCtHf9P8YYt1miqdZtxz3VO', '동화', 6),
    ('너울나비 음악모음', 'https://www.youtube.com/playlist?list=PLyCo9nr0e8FB0O8CgYLzdOi-ylX5b50Rl', '동화', 7),
    ('호호샘의 잠자리동화', 'https://www.youtube.com/@%ED%98%B8%ED%98%B8%EC%83%98/videos', '동화', 8),
    ('넘버블록스 영어 level1', 'https://www.youtube.com/playlist?list=PLlhYaqm9XIz66vhwiVDbt3FjM7QEkmhfI', '영어', 9),
    ('넘버블록스 영어 level2', 'https://www.youtube.com/playlist?list=PLlhYaqm9XIz7E_lHii3SBs5YHu0NPPUat', '영어', 10),
    ('블루이 한글', 'https://www.youtube.com/watch?v=_fBTK65O3-8&list=PLPrhyopf_mxsqT9PTjTImW9Kp5lhT9nji', '한글', 11),
    ('블루이 영어 시즌1', 'https://www.youtube.com/watch?v=Q-K4TCO7Lp8&list=PLbtUQWldWkKjU-Xo1hgBKLVpxnAddy7a7', '영어', 12),
    ('블루이 영어 시즌2', 'https://www.youtube.com/watch?v=4DNTzwCDl_k&list=PLbtUQWldWkKjO6WEK3M5L7v9RL_5goFvK', '영어', 13)
) as v(title, playlist_url, category, order_index)
where not exists (
  select 1 from public.content_channels c where c.title = v.title
);

-- ── 마켓 상품: 콘텐츠 이용권 30분 ─────────────────────────────
insert into public.store_items (
  name,
  description,
  image_url,
  credit_price,
  item_type,
  category,
  level_required,
  is_active
)
select
  '콘텐츠 이용권 30분',
  '콘텐츠존에서 30분 동안 영상을 볼 수 있는 이용권이에요.',
  '/assets/img/items/shop/items/movie_ticket.png',
  200,
  'digital',
  'digital',
  1,
  true
where not exists (
  select 1 from public.store_items si where si.name = '콘텐츠 이용권 30분' and si.family_link_id is null
);
