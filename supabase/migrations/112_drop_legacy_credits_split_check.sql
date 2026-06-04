-- ============================================================
-- 112_drop_legacy_credits_split_check.sql
-- plant-buy-seed 등 credits 만 줄일 때 실패하던 예전 제약 제거
--
-- (040) credits_wallet + credits_piggy <= credits
-- (107) 에서 이미 제거했을 수 있음 — 중복 실행 안전
-- ============================================================

alter table public.child_stats
  drop constraint if exists child_stats_credits_split_check;
