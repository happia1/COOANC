-- ============================================================
-- 129_piggy_bonus_low_rates_with_carry.sql
--
-- 저금통 이자율을 현실적인 수준으로 낮추고, 낮은 요율에서도 정확히 동작하도록
-- 「소수점 이월」을 도입합니다.
--
-- 바뀐 점 (128 → 129)
--   1) 요율 인하: 10~25% → 1~2.5%
--        10개 이상  → 1.0%
--        50개 이상  → 1.5%
--        100개 이상 → 2.0%
--        200개 이상 → 2.5%
--
--   2) 「최소 1개 보장」 제거 + 소수점 이월 도입
--      왜 필요한가: 10개의 1%는 0.1개입니다.
--        - 최소 1개를 주면 → 사실상 10%가 되어 요율 인하가 무의미해집니다.
--        - 그냥 버리면    → 영원히 0개라 저금통이 고장 난 것처럼 보입니다.
--      그래서 0.1개씩 `piggy_bonus_fraction` 에 쌓아 두었다가 1개가 되면 코인으로 띄웁니다.
--      지급은 여전히 정수 크레딧만 나갑니다.
--
--      체감 (3일 주기)
--        10개 저금 → 30일마다 코인 1개
--        50개 저금 →  6일마다 코인 1개
--        100개 저금 →  3일마다 코인 2개
--        200개 저금 →  3일마다 코인 5개
--
-- 실행 후 확인:
--   select child_id, credits_piggy, piggy_bonus_pending, piggy_bonus_fraction
--     from public.child_stats where credits_piggy >= 10;
-- ============================================================

alter table public.child_stats
  add column if not exists piggy_bonus_fraction numeric not null default 0;

comment on column public.child_stats.piggy_bonus_fraction is
  '아직 코인 1개가 되지 못한 이자 소수점(0 이상 1 미만). 1을 넘으면 piggy_bonus_pending 으로 넘어갑니다.';

/**
 * 저금액 구간별 이자율 — 여기만 고치면 요율이 바뀝니다.
 * 반환값 0 은 「기준 미달(이자 없음)」입니다.
 */
create or replace function public.piggy_bonus_rate_for(p_piggy int)
returns numeric
language sql
immutable
as $$
  select case
    when p_piggy >= 200 then 0.025
    when p_piggy >= 100 then 0.020
    when p_piggy >= 50  then 0.015
    when p_piggy >= 10  then 0.010
    else 0
  end;
$$;

grant execute on function public.piggy_bonus_rate_for(int) to authenticated, service_role;

/**
 * 저금통 이자 정산 — 행 잠금으로 중복 지급을 막습니다.
 *
 * 회차마다 `저금액 × 요율`을 소수점 저금통(`piggy_bonus_fraction`)에 더하고,
 * 1을 넘긴 만큼만 정수로 떼어 `piggy_bonus_pending`(받을 코인)으로 옮깁니다.
 *
 * 반환: { paid, pending, fraction, periods, credits_piggy, rate, since, next_at }
 */
create or replace function public.settle_piggy_bonus(p_child_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_min_balance constant int := 10;   -- 이자가 붙기 시작하는 최소 저금액
  c_hold_days   constant int := 3;    -- 지급 주기(일)
  c_max_periods constant int := 40;   -- 한 번에 정산할 최대 회차(폭주 방지)

  v_piggy      int;
  v_pending    int;
  v_fraction   numeric;
  v_since      timestamptz;
  v_last_paid  timestamptz;
  v_anchor     timestamptz;
  v_rate       numeric;
  v_paid_total int := 0;
  v_periods    int := 0;
  v_whole      int;
begin
  select credits_piggy,
         coalesce(piggy_bonus_pending, 0),
         coalesce(piggy_bonus_fraction, 0),
         piggy_bonus_since,
         piggy_bonus_last_paid_at
    into v_piggy, v_pending, v_fraction, v_since, v_last_paid
    from child_stats
   where child_id = p_child_id
     for update;

  if not found then
    return jsonb_build_object('paid', 0, 'pending', 0, 'periods', 0, 'credits_piggy', 0);
  end if;

  v_piggy := coalesce(v_piggy, 0);
  v_rate := piggy_bonus_rate_for(v_piggy);

  -- 최소 기준 미만이면 기간 리셋.
  -- 이미 쌓인 pending·소수점은 아이가 모은 몫이므로 그대로 둡니다.
  if v_piggy < c_min_balance then
    update child_stats
       set piggy_bonus_since = null,
           piggy_bonus_last_paid_at = null
     where child_id = p_child_id;
    return jsonb_build_object(
      'paid', 0, 'pending', v_pending, 'fraction', v_fraction, 'periods', 0,
      'credits_piggy', v_piggy, 'rate', 0, 'since', null, 'next_at', null
    );
  end if;

  if v_since is null then
    v_since := now();
    update child_stats
       set piggy_bonus_since = v_since,
           piggy_bonus_last_paid_at = null
     where child_id = p_child_id;
  end if;

  v_anchor := coalesce(v_last_paid, v_since);

  while v_periods < c_max_periods
        and now() >= v_anchor + make_interval(days => c_hold_days) loop
    v_fraction := v_fraction + (v_piggy * v_rate);
    v_anchor := v_anchor + make_interval(days => c_hold_days);
    v_periods := v_periods + 1;

    -- 1개가 찼으면 정수만 떼어 코인으로 넘기고, 나머지 소수점은 다음 회차로 이월
    v_whole := floor(v_fraction)::int;
    if v_whole > 0 then
      v_fraction := v_fraction - v_whole;
      v_pending := v_pending + v_whole;
      v_paid_total := v_paid_total + v_whole;

      insert into piggy_bonus_grants (child_id, amount, piggy_before, piggy_after, rate)
      values (p_child_id, v_whole, v_piggy, v_piggy, v_rate);
    end if;
  end loop;

  if v_periods > 0 then
    update child_stats
       set piggy_bonus_pending = v_pending,
           piggy_bonus_fraction = v_fraction,
           piggy_bonus_last_paid_at = v_anchor,
           updated_at = now()
     where child_id = p_child_id;
  end if;

  return jsonb_build_object(
    'paid', v_paid_total,
    'pending', v_pending,
    'fraction', v_fraction,
    'periods', v_periods,
    'credits_piggy', v_piggy,
    'rate', v_rate,
    'since', v_since,
    'next_at', v_anchor + make_interval(days => c_hold_days)
  );
end;
$$;

grant execute on function public.settle_piggy_bonus(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
