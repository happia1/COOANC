-- ============================================================
-- 127_piggy_bonus_and_bell_ack.sql
--
-- (1) 저금통 보너스(이자)를 DB 기준으로 구현
--     기존에는 「저금 시작일」을 기기 localStorage 에만 적어 두고 지급 로직이 아예 없었습니다.
--     → 기기마다 값이 달랐고, 실제로 보너스가 지급되지도 않았습니다.
--
--     규칙(상수는 아래 함수 상단에서 한 곳만 고치면 됩니다):
--       - 저금통 잔액이 10 크레딧 이상이 된 시점부터 기간이 시작됩니다.
--       - 7일을 유지하면 그 시점 잔액의 10%(소수점 버림, 최소 1)를 저금통에 넣어 줍니다.
--       - 잔액이 10 미만으로 내려가면 기간이 리셋됩니다(조금 빼는 건 허용).
--       - 오래 앱을 안 열었어도 지나간 주차만큼 정산합니다(최대 12주 = 폭주 방지).
--
-- (2) 부모 알림(구매 승인 대기) 확인 상태를 DB 로 이동
--     기존에는 기기 localStorage 라, 노트북에서 확인해도 폰에는 뱃지가 남았습니다.
--
-- 실행 후 확인:
--   select child_id, credits_piggy, piggy_bonus_since, piggy_bonus_last_paid_at
--     from public.child_stats where credits_piggy >= 10;
-- ============================================================

-- ── (1) 저금통 보너스 ────────────────────────────────────────

alter table public.child_stats
  add column if not exists piggy_bonus_since timestamptz,
  add column if not exists piggy_bonus_last_paid_at timestamptz;

comment on column public.child_stats.piggy_bonus_since is
  '저금통 잔액이 최소 기준(10) 이상이 된 시각. 기준 미만으로 내려가면 null 로 리셋됩니다.';
comment on column public.child_stats.piggy_bonus_last_paid_at is
  '마지막으로 저금통 보너스를 지급한 시각. 다음 지급은 여기서 7일 뒤입니다.';

-- 지급 내역(자녀 앱 안내·부모 확인용)
create table if not exists public.piggy_bonus_grants (
  id           uuid        primary key default gen_random_uuid(),
  child_id     uuid        not null references public.profiles(id) on delete cascade,
  amount       int         not null check (amount > 0),
  piggy_before int         not null,
  piggy_after  int         not null,
  granted_at   timestamptz not null default now()
);

create index if not exists idx_piggy_bonus_grants_child
  on public.piggy_bonus_grants (child_id, granted_at desc);

alter table public.piggy_bonus_grants enable row level security;

drop policy if exists "piggy_bonus_grants_access" on public.piggy_bonus_grants;
create policy "piggy_bonus_grants_access"
  on public.piggy_bonus_grants for select
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links
       where parent_id = auth.uid() and child_id = piggy_bonus_grants.child_id
    )
  );

/**
 * 저금통 보너스 정산 — 행 잠금으로 중복 지급을 막습니다.
 * 반환: { paid, periods, credits_piggy, since, last_paid_at, next_at }
 */
create or replace function public.settle_piggy_bonus(p_child_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- ── 기획 상수(여기만 고치면 됩니다) ──
  c_min_balance constant int := 10;    -- 보너스 기간이 시작되는 최소 저금액
  c_hold_days   constant int := 7;     -- 유지해야 하는 일수
  c_rate        constant numeric := 0.10;  -- 지급 비율(잔액의 10%)
  c_max_periods constant int := 12;    -- 한 번에 정산할 최대 주차(폭주 방지)

  v_piggy      int;
  v_since      timestamptz;
  v_last_paid  timestamptz;
  v_anchor     timestamptz;
  v_paid_total int := 0;
  v_periods    int := 0;
  v_amount     int;
  v_before     int;
begin
  select credits_piggy, piggy_bonus_since, piggy_bonus_last_paid_at
    into v_piggy, v_since, v_last_paid
    from child_stats
   where child_id = p_child_id
     for update;

  if not found then
    return jsonb_build_object('paid', 0, 'periods', 0, 'credits_piggy', 0);
  end if;

  v_piggy := coalesce(v_piggy, 0);

  -- 최소 기준 미만이면 기간 리셋(조금 빼는 건 허용, 기준 아래로만 리셋)
  if v_piggy < c_min_balance then
    update child_stats
       set piggy_bonus_since = null,
           piggy_bonus_last_paid_at = null
     where child_id = p_child_id;
    return jsonb_build_object(
      'paid', 0, 'periods', 0, 'credits_piggy', v_piggy,
      'since', null, 'next_at', null
    );
  end if;

  -- 기준 이상인데 기간이 시작되지 않았으면 지금부터 시작
  if v_since is null then
    v_since := now();
    update child_stats
       set piggy_bonus_since = v_since,
           piggy_bonus_last_paid_at = null
     where child_id = p_child_id;
  end if;

  -- 다음 지급 기준 시점 = 마지막 지급 시각(없으면 기간 시작 시각)
  v_anchor := coalesce(v_last_paid, v_since);

  while v_periods < c_max_periods
        and now() >= v_anchor + make_interval(days => c_hold_days) loop
    v_before := v_piggy;
    v_amount := greatest(1, floor(v_piggy * c_rate)::int);
    v_piggy := v_piggy + v_amount;
    v_anchor := v_anchor + make_interval(days => c_hold_days);
    v_paid_total := v_paid_total + v_amount;
    v_periods := v_periods + 1;

    insert into piggy_bonus_grants (child_id, amount, piggy_before, piggy_after)
    values (p_child_id, v_amount, v_before, v_piggy);
  end loop;

  if v_periods > 0 then
    update child_stats
       set credits_piggy = v_piggy,
           piggy_bonus_last_paid_at = v_anchor,
           updated_at = now()
     where child_id = p_child_id;
  end if;

  return jsonb_build_object(
    'paid', v_paid_total,
    'periods', v_periods,
    'credits_piggy', v_piggy,
    'since', v_since,
    'next_at', v_anchor + make_interval(days => c_hold_days)
  );
end;
$$;

grant execute on function public.settle_piggy_bonus(uuid) to authenticated, service_role;

-- ── (2) 부모 알림 확인 상태(기기 → DB) ──────────────────────

create table if not exists public.parent_purchase_request_acks (
  parent_id           uuid        not null references public.profiles(id) on delete cascade,
  purchase_request_id uuid        not null references public.purchase_requests(id) on delete cascade,
  acked_at            timestamptz not null default now(),
  primary key (parent_id, purchase_request_id)
);

alter table public.parent_purchase_request_acks enable row level security;

drop policy if exists "parent_purchase_request_acks_self" on public.parent_purchase_request_acks;
create policy "parent_purchase_request_acks_self"
  on public.parent_purchase_request_acks for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

notify pgrst, 'reload schema';
