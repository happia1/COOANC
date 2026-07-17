-- ============================================================
-- 118_unify_content_tickets.sql
-- 영상/미니게임으로 나뉘어 있던 콘텐츠 이용권을 "보물상자 티켓" 하나로 통합
-- ============================================================

-- 1) 기존 '영상 시청권 30분' 상품을 '보물상자 이용권'으로 개명
--    (기존 가격은 150크레딧이었음 — 200으로 명시 변경)
update public.store_items
set
  name = '보물상자 이용권',
  image_url = '/assets/img/items/stickers/treasure.png',
  credit_price = 200,
  description = '보물상자에서 영상 시청이나 인형뽑기 미니게임에 쓸 수 있는 이용권이에요.'
where family_link_id is null
  and name = '영상 시청권 30분';

-- 2) 이제 중복인 '미니게임 이용권' 상품은 비활성화 (이력 보존용으로 행은 남김)
update public.store_items
set is_active = false
where family_link_id is null
  and name = '미니게임 이용권';

-- 3) minigame_tickets.quantity 를 content_tickets.quantity 에 합산
insert into public.content_tickets (child_id, quantity, watch_seconds_remaining, updated_at)
select mt.child_id, mt.quantity, 0, now()
from public.minigame_tickets mt
where mt.quantity > 0
on conflict (child_id) do update
  set quantity = public.content_tickets.quantity + excluded.quantity,
      updated_at = now();

-- 4) content_tickets.quantity 의 의미를 문서화 (테이블/컬럼 구조 자체는 변경하지 않음)
comment on column public.content_tickets.quantity is
  '자녀별 보물상자(콘텐츠) 통합 이용권 수. 영상 30분 시청 1회 또는 인형뽑기(클로우 머신) 세션 1회 시작에 사용됩니다. (구 minigame_tickets 는 118 마이그레이션에서 이 컬럼으로 합쳐졌습니다.)';

-- 5) 더 이상 쓰이지 않는 미니게임 전용 티켓 테이블/함수 제거
drop function if exists public.grant_minigame_ticket(uuid, int);
drop table if exists public.minigame_tickets;

-- 6) 과거 구매내역 상품명 스냅샷을 새 이름으로 정규화 (표시 일관성용)
update public.purchase_requests
set item_name = '보물상자 이용권'
where item_name in ('영상 시청권 30분', '미니게임 이용권', '콘텐츠 30분 이용권', '콘텐츠 이용권 30분');
