-- ============================================================
-- 107: child_stats.credits = 「레벨 블록에 보이는 쓸 수 있는 크레딧」
--
-- 비개발자 설명:
-- - 예전에는 credits 가 총액이고, 지갑·저금통·돈바구니로 나눠 썼습니다.
-- - 이제 credits 는 레벨 카드 숫자(바로 쓸 수 있는 돈), credits_piggy 는 저금통만 따로 둡니다.
-- - credits_wallet 은 더 이상 쓰지 않으며 0 으로 맞춥니다.
-- ============================================================

update public.child_stats
set
  credits = greatest(0, credits - coalesce(credits_wallet, 0) - coalesce(credits_piggy, 0)),
  credits_wallet = 0;

alter table public.child_stats
  drop constraint if exists child_stats_credits_split_check;

alter table public.child_stats
  add constraint child_stats_credits_available_check
  check (
    credits >= 0
    and credits_piggy >= 0
    and coalesce(credits_wallet, 0) >= 0
  );

comment on column public.child_stats.credits is '레벨 블록·마켓에서 쓰는 가용 크레딧(저금통 제외)';
comment on column public.child_stats.credits_wallet is '레거시 컬럼(미사용, 0 유지)';
comment on column public.child_stats.credits_piggy is '저금통에 모아 둔 크레딧';
