-- ============================================================
-- 105_purchase_rewards_granted_at.sql
--
-- 비개발자 요약:
--   • 마켓 구매 1건당 이용권 지급은 한 번만 되도록 표시합니다.
--   • 부모 승인·자녀 「받았어요」가 겹쳐도 3개 구매 → 6개 지급되지 않습니다.
-- ============================================================

alter table public.purchase_requests
  add column if not exists rewards_granted_at timestamptz;

comment on column public.purchase_requests.rewards_granted_at is
  '콘텐츠·미니게임 이용권 지급 완료 시각 (중복 지급 방지)';
