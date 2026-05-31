-- ============================================================
-- 100_add_cracker_snack.sql
--
-- 비개발자 요약:
--   • 간식 「크래커」를 기본 카탈로그에 추가합니다.
--   • 가격은 칩스와 동일하게 맞춥니다.
--   • 노출 순서는 앱 `betaMarketConfig.activeFood`(칩스 다음)를 따릅니다.
-- ============================================================

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
  '크래커',
  '바삭한 크래커 간식이에요.',
  '/assets/img/items/shop/items/건강간식/cracker.png',
  coalesce(
    (
      select si.credit_price
      from public.store_items si
      where si.family_link_id is null
        and si.category = 'food'
        and si.name = '칩스'
      limit 1
    ),
    100
  ),
  'real',
  'food',
  1,
  true
where not exists (
  select 1
  from public.store_items si
  where si.family_link_id is null
    and si.category = 'food'
    and si.name = '크래커'
);
