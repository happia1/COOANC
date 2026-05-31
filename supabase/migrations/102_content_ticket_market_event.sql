-- ============================================================
-- 102_content_ticket_market_event.sql
--
-- 비개발자 요약:
--   • 이벤트 마켓에 「콘텐츠 30분 이용권」 추가 (experience 카테고리)
--   • 구매 요청에 수량(quantity) 필드 추가 — 여러 장 한 번에 구매 가능
-- ============================================================

alter table public.purchase_requests
  add column if not exists quantity int not null default 1 check (quantity >= 1);

comment on column public.purchase_requests.quantity is
  '구매 수량 — 콘텐츠 이용권 등 여러 장 구매 시 사용';

-- 예전 digital 행을 이벤트 마켓용으로 맞춤
update public.store_items
set
  name = '콘텐츠 30분 이용권',
  description = '콘텐츠존에서 30분 동안 영상을 볼 수 있는 이용권이에요. 필요한 만큼 수량을 구매할 수 있어요.',
  image_url = '/assets/img/items/shop/items/이벤트/icon.png',
  category = 'experience',
  item_type = 'digital',
  is_active = true
where family_link_id is null
  and name in ('콘텐츠 이용권 30분', '콘텐츠 30분 이용권');

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
  '콘텐츠 30분 이용권',
  '콘텐츠존에서 30분 동안 영상을 볼 수 있는 이용권이에요. 필요한 만큼 수량을 구매할 수 있어요.',
  '/assets/img/items/shop/items/이벤트/icon.png',
  200,
  'digital',
  'experience',
  1,
  true
where not exists (
  select 1
  from public.store_items si
  where si.family_link_id is null
    and si.name = '콘텐츠 30분 이용권'
);
