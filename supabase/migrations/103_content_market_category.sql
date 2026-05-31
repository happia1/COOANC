-- ============================================================
-- 103_content_market_category.sql
--
-- 비개발자 요약:
--   • 마켓에 「콘텐츠」 카테고리를 추가합니다 (이벤트 다음 구역).
--   • 영상 시청권 30분(150크레딧), 미니게임 이용권(70크레딧/회) 상품 등록
--   • 미니게임 이용권 보유 수 테이블·지급 RPC 추가
-- ============================================================

-- 1) store_items.category 에 content 허용
alter table public.store_items drop constraint if exists store_items_category_check;

alter table public.store_items
  add constraint store_items_category_check
  check (category in ('food', 'toy', 'activity', 'digital', 'experience', 'content'));

-- 2) 예전 이벤트 구역 콘텐츠 이용권 비활성화
update public.store_items
set is_active = false
where family_link_id is null
  and name in ('콘텐츠 30분 이용권', '콘텐츠 이용권 30분');

-- 3) 콘텐츠 마켓 상품
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
  '영상 시청권 30분',
  '콘텐츠존에서 30분 동안 영상을 볼 수 있는 이용권이에요. 필요한 만큼 수량을 구매할 수 있어요.',
  '/assets/img/items/shop/items/콘텐츠/contents.png',
  150,
  'digital',
  'content',
  1,
  true
where not exists (
  select 1
  from public.store_items si
  where si.family_link_id is null
    and si.name = '영상 시청권 30분'
);

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
  '미니게임 이용권',
  '미니게임을 1회 플레이할 수 있는 이용권이에요. 필요한 만큼 수량을 구매할 수 있어요.',
  '/assets/img/items/shop/items/콘텐츠/minigame.png',
  70,
  'digital',
  'content',
  1,
  true
where not exists (
  select 1
  from public.store_items si
  where si.family_link_id is null
    and si.name = '미니게임 이용권'
);

update public.store_items
set
  credit_price = 150,
  category = 'content',
  item_type = 'digital',
  is_active = true,
  description = '콘텐츠존에서 30분 동안 영상을 볼 수 있는 이용권이에요. 필요한 만큼 수량을 구매할 수 있어요.',
  image_url = '/assets/img/items/shop/items/콘텐츠/contents.png'
where family_link_id is null
  and name = '영상 시청권 30분';

update public.store_items
set
  credit_price = 70,
  category = 'content',
  item_type = 'digital',
  is_active = true,
  description = '미니게임을 1회 플레이할 수 있는 이용권이에요. 필요한 만큼 수량을 구매할 수 있어요.',
  image_url = '/assets/img/items/shop/items/콘텐츠/minigame.png'
where family_link_id is null
  and name = '미니게임 이용권';

-- 4) 미니게임 이용권 보유 수
create table if not exists public.minigame_tickets (
  id         uuid primary key default uuid_generate_v4(),
  child_id   uuid not null references public.profiles (id) on delete cascade,
  quantity   int not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (child_id)
);

comment on table public.minigame_tickets is
  '자녀별 미니게임 이용권(회) 보유 수.';

create index if not exists idx_minigame_tickets_child
  on public.minigame_tickets (child_id);

alter table public.minigame_tickets enable row level security;

drop policy if exists "minigame_tickets_child_access" on public.minigame_tickets;

create policy "minigame_tickets_child_access"
  on public.minigame_tickets
  for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = minigame_tickets.child_id
    )
  )
  with check (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = minigame_tickets.child_id
    )
  );

grant select, insert, update on table public.minigame_tickets to authenticated;

create or replace function public.grant_minigame_ticket(p_child_id uuid, p_amount int default 1)
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

  insert into public.minigame_tickets (child_id, quantity, updated_at)
  values (p_child_id, p_amount, now())
  on conflict (child_id) do update
    set quantity = public.minigame_tickets.quantity + p_amount,
        updated_at = now()
  returning quantity into v_qty;

  return v_qty;
end;
$$;

comment on function public.grant_minigame_ticket(uuid, int) is
  '자녀에게 미니게임 이용권(회)을 지급합니다(upsert).';

grant execute on function public.grant_minigame_ticket(uuid, int) to authenticated;

-- 5) 구매 이력 스냅샷 — 예전 이름 통일
update public.purchase_requests
set item_name = '영상 시청권 30분'
where item_name in ('콘텐츠 30분 이용권', '콘텐츠 이용권 30분');
