-- ============================================================
-- 045_store_movie_image_and_free_hug.sql
-- - 영화 보기: DB image_url 이 없는 movie.png 를 가리키면 이미지가 깨짐 → movie_ticket.png 로 수정
-- - 안아주기 쿠폰: 기본가 무료(0) — 이미 044 이후 갱신된 DB 에도 안전하게 다시 맞춤
-- - 츄 쿠폰: 동일(무료 기본값 재확인)
-- ============================================================

update public.store_items
set credit_price = 0
where name in ('아빠 츄 쿠폰', '엄마 츄 쿠폰', '안아주기 쿠폰');

update public.store_items
set image_url = '/assets/img/items/shop/items/movie_ticket.png'
where name = '영화 보기';
