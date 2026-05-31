-- ============================================================
-- 097_snack_catalog_cleanup_and_activate.sql
--
-- 비개발자 요약:
--   • 뽀로로 간식 행을 DB에서 완전히 삭제합니다(이미지 파일도 제거됨).
--   • 예전 이름(텐텐·젤리·육포·츄잉껌 등)을 현재 상품명과 맞춥니다.
--   • 기본 카탈로그에서 비활성(is_active=false)이던 간식을 모두 켭니다.
-- ============================================================

-- 1) 뽀로로 — 구매 이력 FK만 풀고 행 삭제(연관 숨김·위시·순서는 cascade)
update public.purchase_requests
set item_id = null
where item_id in (
  select id
  from public.store_items
  where category = 'food'
    and name = '뽀로로'
);

delete from public.store_items
where category = 'food'
  and name = '뽀로로';

-- 2) 간식 상품명·설명·가격을 현재 기준으로 통일 (095와 동일, 재실행 안전)
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

-- 3) 구매 요청 스냅샷 상품명도 화면 표시용으로 맞춤
update public.purchase_requests
set item_name = case item_name
  when '젤리' then '비타민 구미'
  when '육포' then '어린이 육포'
  when '츄잉껌' then '츄잉캔디'
  when '츄잉검' then '츄잉캔디'
  when '텐텐' then '어린이 영양제'
  else item_name
end
where item_name in ('젤리', '육포', '츄잉껌', '츄잉검', '텐텐');

-- 4) 기본 카탈로그 비활성 간식 전부 활성화
update public.store_items
set is_active = true
where category = 'food'
  and family_link_id is null
  and is_active = false;
