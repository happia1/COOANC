-- ============================================================
-- 095_update_snack_default_names_and_prices.sql
-- 요청 반영: 기본 간식 상품명/기본 크레딧을 아래 값으로 조정합니다.
-- - 대상: 기본 카탈로그(store_items.family_link_id is null, category='food')
-- - 자녀별 개별 덮어쓰기(child_store_item_credit_overrides)는 유지
-- ============================================================
--
-- 견과류 50
-- 뮤즐리 60
-- 그릭요거트 60
-- 젤리 -> 비타민 구미 70
-- 육포 -> 어린이 육포 90
-- 팝콘 150
-- 초코우유 100
-- 딸기우유 100
-- 초콜릿 120
-- 치즈 90
-- 츄잉껌/츄잉검 -> 츄잉캔디 120
-- 텐텐 -> 어린이 영양제 50
-- ============================================================

update public.store_items
set
  name = case
    when name = '젤리' then '비타민 구미'
    when name = '육포' then '어린이 육포'
    when name in ('츄잉껌', '츄잉검') then '츄잉캔디'
    when name = '텐텐' then '어린이 영양제'
    else name
  end,
  credit_price = case
    when name = '견과류' then 50
    when name = '뮤즐리' then 60
    when name = '그릭요거트' then 60
    when name in ('젤리', '비타민 구미') then 70
    when name in ('육포', '어린이 육포') then 90
    when name = '팝콘' then 150
    when name = '초코우유' then 100
    when name = '딸기우유' then 100
    when name = '초콜릿' then 120
    when name = '치즈' then 90
    when name in ('츄잉껌', '츄잉검', '츄잉캔디') then 120
    when name in ('텐텐', '어린이 영양제') then 50
    else credit_price
  end,
  description = case
    when name in ('젤리', '비타민 구미') then '비타민 구미 간식이에요.'
    when name in ('육포', '어린이 육포') then '맛있는 어린이 육포 간식이에요.'
    when name in ('츄잉껌', '츄잉검', '츄잉캔디') then '달콤한 츄잉캔디 간식이에요.'
    when name in ('텐텐', '어린이 영양제') then '어린이 영양제 간식이에요.'
    else description
  end
where family_link_id is null
  and category = 'food'
  and name in (
    '견과류',
    '뮤즐리',
    '그릭요거트',
    '젤리',
    '비타민 구미',
    '육포',
    '어린이 육포',
    '팝콘',
    '초코우유',
    '딸기우유',
    '초콜릿',
    '치즈',
    '츄잉껌',
    '츄잉검',
    '츄잉캔디',
    '텐텐',
    '어린이 영양제'
  );
