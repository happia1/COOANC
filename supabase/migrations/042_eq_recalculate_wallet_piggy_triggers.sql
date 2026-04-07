-- ============================================================
-- 042: EQ 지수를 지갑·저금통·섬(가용) 모델에 맞춤 + 자동 갱신 트리거
--
-- eq_save_ratio   : 지갑+저금통 중 저금통 비중(0~100). 섬(미배분)은 분모에서 제외.
-- eq_delay_score  : 전체 보유(credits) 대비 저금통 비중(0~100) — 「나중에 쓰기」로 묶인 비율.
-- eq_routine_rate : 기존과 동일 — 최근 14일 mission_logs 완료/배정 비율.
--
-- 갱신 시점:
--   · mission_logs INSERT/UPDATE — 루틴·(크레딧 변화 시 간접 반영)
--   · child_stats 의 credits_wallet / credits_piggy 변경 — 도넛·만족 지연 즉시 반영
-- 미션 보상은 보통 credits(섬)만 늘리므로 wallet/piggy 트리거는 안 타고,
-- mission_logs 트리거가 루틴·저장 비율을 다시 계산합니다.
-- ============================================================

create or replace function recalculate_eq(p_child_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_total_assigned  int;
  v_total_completed int;
  v_routine_rate    int;
  v_credits         int;
  v_w               int;
  v_p               int;
  v_save_ratio      int;
  v_delay_score     int;
begin
  -- ① 루틴 완주율: 최근 14일 배정 미션 대비 완료 비율
  select
    count(*),
    count(*) filter (where is_completed = true)
  into v_total_assigned, v_total_completed
  from mission_logs
  where child_id = p_child_id
    and assigned_date >= current_date - interval '14 days';

  v_routine_rate := case
    when v_total_assigned = 0 then 0
    else (v_total_completed * 100 / v_total_assigned)
  end;

  -- ② child_stats 에서 지갑·저금통·총액 읽기 (섬 = credits - wallet - piggy 는 비중 계산에 직접 쓰지 않음)
  select
    coalesce(credits, 0),
    coalesce(credits_wallet, 0),
    coalesce(credits_piggy, 0)
  into v_credits, v_w, v_p
  from child_stats
  where child_id = p_child_id;

  -- 저축 비중: 「지갑에 쓸 돈」과 「저금통에 묶인 돈」만 비교 (섬은 아직 결정 안 한 돈이므로 제외)
  v_save_ratio := case
    when (v_w + v_p) > 0 then least(100, round((v_p::numeric * 100) / (v_w + v_p))::int)
    else 0
  end;

  -- 만족 지연: 전체 자산 중 저금통에 묶인 비율 — 기다림·참기와 연결되는 지표
  v_delay_score := case
    when v_credits > 0 then least(100, round((v_p::numeric * 100) / v_credits)::int)
    else 0
  end;

  update child_stats set
    eq_routine_rate = v_routine_rate,
    eq_save_ratio   = v_save_ratio,
    eq_delay_score  = v_delay_score,
    updated_at      = now()
  where child_id = p_child_id;
end;
$$;

comment on function recalculate_eq(uuid) is
  'EQ 3축 갱신: 루틴(14일 로그), 저축비중(지갑+저금통 중 저금통), 만족지연(총액 대비 저금통)';

comment on column public.child_stats.eq_save_ratio is
  '저축 비중 0~100: 지갑+저금통 중 저금통 비율(섬·가용 크레딧은 분모에서 제외)';
comment on column public.child_stats.eq_delay_score is
  '만족 지연 지수 0~100: 전체 credits 대비 저금통(credits_piggy) 비율';

-- ── 지갑/저금통 이동 시 EQ 갱신 (미션 보상만 credits 증가할 때는 이 트리거는 실행되지 않음)
create or replace function trg_child_stats_recalc_eq_fn()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  perform recalculate_eq(new.child_id);
  return new;
end;
$$;

drop trigger if exists trg_child_stats_recalc_eq on child_stats;
create trigger trg_child_stats_recalc_eq
  after update of credits_wallet, credits_piggy
  on child_stats
  for each row
  when (
    old.credits_wallet is distinct from new.credits_wallet
    or old.credits_piggy is distinct from new.credits_piggy
  )
  execute procedure trg_child_stats_recalc_eq_fn();

-- ── 미션 로그 변화 시 루틴·(필요 시) 전체 EQ 재계산 — 완료 처리 후에 실행되어 집계가 맞음
create or replace function trg_mission_logs_recalc_eq_fn()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  perform recalculate_eq(new.child_id);
  return new;
end;
$$;

drop trigger if exists trg_mission_logs_recalc_eq on mission_logs;
create trigger trg_mission_logs_recalc_eq
  after insert or update
  on mission_logs
  for each row
  execute procedure trg_mission_logs_recalc_eq_fn();

-- 기존 행 일괄 반영
do $$
declare
  r record;
begin
  for r in select child_id from child_stats loop
    perform recalculate_eq(r.child_id);
  end loop;
end $$;
