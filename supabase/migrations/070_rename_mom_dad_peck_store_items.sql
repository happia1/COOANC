-- ============================================================
-- 070_rename_mom_dad_peck_store_items.sql
-- 마켓 이벤트: 「엄마 츄 쿠폰」「아빠 츄 쿠폰」→「엄마 뽀뽀」「아빠 뽀뽀」
--
-- 비개발자 설명:
--   부모 메뉴 제어·자녀 마켓은 `betaMarketConfig.activeEvents` 와 이름이 정확히 같아야
--   「준비중」이 없이 켜집니다. DB 상품 이름을 그 목록(엄마/아빠 뽀뽀)에 맞춥니다.
-- ============================================================

update public.store_items
set
  name = '엄마 뽀뽀',
  description = '엄마와 뽀뽀로 마음을 표현해요.',
  is_active = true
where name = '엄마 츄 쿠폰';

update public.store_items
set
  name = '아빠 뽀뽀',
  description = '아빠와 뽀뽀로 마음을 표현해요.',
  is_active = true
where name = '아빠 츄 쿠폰';
