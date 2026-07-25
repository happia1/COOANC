-- ============================================================
-- 128_piggy_bonus_tiers_and_claim.sql
--
-- 저금통 이자 규칙 변경 + 「직접 눌러서 받기」 방식으로 전환합니다.
--
-- 바뀐 점 (127 → 128)
--   1) 지급 주기: 7일 → 3일
--   2) 지급률: 고정 10% → 저금액 구간별
--        10개 이상  → 10%
--        50개 이상  → 15%
--        100개 이상 → 20%
--        200개 이상 → 25%
--      (소수점은 버려서 항상 정수 크레딧으로만 지급됩니다)
--   3) 지급 방식: 저금통에 자동 입금 → `piggy_bonus_pending`(받을 보너스)에 쌓임
--      자녀가 저금통 위에 뜬 반짝이는 코인을 1개씩 눌러서 크레딧으로 받아 갑니다.
--
-- 실행 후 확인:
--   select child_id, credits_piggy, piggy_bonus_pending, piggy_bonus_last_paid_at
--     from public.child_stats where credits_piggy >= 10;
-- ============================================================

alter table public.child_stats
  add column if not exists piggy_bonus_pending int not null default 0;

comment on column public.child_stats.piggy_bonus_pending is
  '아직 받아 가지 않은 저금통 이자. 자녀가 저금통 위 코인을 누를 때마다 1씩 credits 로 옮겨집니다.';

-- 지급 내역 테이블에 「받아 간 시각」 기록 (127 에서 만든 표를 재사용)
alter table public.piggy_bonus_grants
  add column if not exists rate numeric;

comment on column public.piggy_bonus_grants.rate is '지급 당시 적용된 요율(0.10 = 10%)';

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
    when p_piggy >= 200 then 0.25
    when p_piggy >= 100 then 0.20
    when p_piggy >= 50  then 0.15
    when p_piggy >= 10  then 0.10
    else 0
  end;
$$;

grant execute on function public.piggy_bonus_rate_for(int) to authenticated, service_role;

/**
 * 저금통 이자 정산 — 행 잠금으로 중복 지급을 막습니다.
 * 지급분은 저금통이 아니라 `piggy_bonus_pending`(받을 보너스)에 쌓입니다.
 * 반환: { paid, pending, periods, credits_piggy, rate, since, next_at }
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
  c_max_periods constant int := 20;   -- 한 번에 정산할 최대 회차(폭주 방지)

  v_piggy      int;
  v_pending    int;
  v_since      timestamptz;
  v_last_paid  timestamptz;
  v_anchor     timestamptz;
  v_rate       numeric;
  v_paid_total int := 0;
  v_periods    int := 0;
  v_amount     int;
begin
  select credits_piggy, coalesce(piggy_bonus_pending, 0), piggy_bonus_since, piggy_bonus_last_paid_at
    into v_piggy, v_pending, v_since, v_last_paid
    from child_stats
   where child_id = p_child_id
     for update;

  if not found then
    return jsonb_build_object('paid', 0, 'pending', 0, 'periods', 0, 'credits_piggy', 0);
  end if;

  v_piggy := coalesce(v_piggy, 0);
  v_rate := piggy_bonus_rate_for(v_piggy);

  -- 최소 기준 미만이면 기간 리셋(이미 쌓인 pending 은 그대로 받을 수 있게 둡니다)
  if v_piggy < c_min_balance then
    update child_stats
       set piggy_bonus_since = null,
           piggy_bonus_last_paid_at = null
     where child_id = p_child_id;
    return jsonb_build_object(
      'paid', 0, 'pending', v_pending, 'periods', 0,
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
    -- 소수점 버림 → 항상 정수 크레딧. 기준을 넘겼으므로 최소 1개는 보장됩니다.
    v_amount := greatest(1, floor(v_piggy * v_rate)::int);
    v_pending := v_pending + v_amount;
    v_anchor := v_anchor + make_interval(days => c_hold_days);
    v_paid_total := v_paid_total + v_amount;
    v_periods := v_periods + 1;

    insert into piggy_bonus_grants (child_id, amount, piggy_before, piggy_after, rate)
    values (p_child_id, v_amount, v_piggy, v_piggy, v_rate);
  end loop;

  if v_periods > 0 then
    update child_stats
       set piggy_bonus_pending = v_pending,
           piggy_bonus_last_paid_at = v_anchor,
           updated_at = now()
     where child_id = p_child_id;
  end if;

  return jsonb_build_object(
    'paid', v_paid_total,
    'pending', v_pending,
    'periods', v_periods,
    'credits_piggy', v_piggy,
    'rate', v_rate,
    'since', v_since,
    'next_at', v_anchor + make_interval(days => c_hold_days)
  );
end;
$$;

grant execute on function public.settle_piggy_bonus(uuid) to authenticated, service_role;

/**
 * 반짝이는 코인을 눌러서 보너스를 받아 갑니다(1번 누를 때 1개).
 * 행 잠금으로 처리하므로 빠르게 여러 번 눌러도 남은 개수보다 많이 받을 수 없습니다.
 * 반환: { claimed, pending, credits }
 */
create or replace function public.claim_piggy_bonus(p_child_id uuid, p_count int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending int;
  v_credits int;
  v_take    int;
begin
  if p_count is null or p_count < 1 then
    p_count := 1;
  end if;

  select coalesce(piggy_bonus_pending, 0), coalesce(credits, 0)
    into v_pending, v_credits
    from child_stats
   where child_id = p_child_id
     for update;

  if not found then
    return jsonb_build_object('claimed', 0, 'pending', 0, 'credits', 0);
  end if;

  v_take := least(p_count, v_pending);
  if v_take <= 0 then
    return jsonb_build_object('claimed', 0, 'pending', v_pending, 'credits', v_credits);
  end if;

  update child_stats
     set piggy_bonus_pending = v_pending - v_take,
         credits = v_credits + v_take,
         updated_at = now()
   where child_id = p_child_id;

  return jsonb_build_object(
    'claimed', v_take,
    'pending', v_pending - v_take,
    'credits', v_credits + v_take
  );
end;
$$;

grant execute on function public.claim_piggy_bonus(uuid, int) to authenticated, service_role;

notify pgrst, 'reload schema';
