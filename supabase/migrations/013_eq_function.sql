-- ============================================================
-- 013_eq_function.sql
-- recalculate_eq() — EQ 3축 지수 자동 계산 함수
-- NOTE: eq_* 컬럼 직접 UPDATE 금지 — 반드시 이 함수 경유
--
-- EQ 3축:
--   eq_routine_rate : 루틴 완주율   (최근 14일 기준, 0~100)
--   eq_save_ratio   : 저축 비중     (최근 30일 기준, 0~100)
--   eq_delay_score  : 만족 지연 지수 (활성 저금통 유지 일수 × 3, 최대 100)
-- ============================================================

create or replace function recalculate_eq(p_child_id uuid)
returns void language plpgsql security definer as $$
declare
  v_total_assigned  int;
  v_total_completed int;
  v_routine_rate    int;
  v_earned_30d      int;
  v_saved_30d       int;
  v_save_ratio      int;
  v_goal_days       int;
  v_delay_score     int;
begin
  -- ① 루틴 완주율: 최근 14일 완료 미션 / 배정 미션
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

  -- ② 저축 비중: 최근 30일 획득 크레딧 대비 저금통 적립 크레딧
  select coalesce(sum(credit_earned), 0)
  into v_earned_30d
  from mission_logs
  where child_id = p_child_id
    and assigned_date >= current_date - interval '30 days'
    and is_completed = true;

  select coalesce(sum(saved_credits), 0)
  into v_saved_30d
  from savings_goals
  where child_id = p_child_id
    and created_at >= current_date - interval '30 days';

  v_save_ratio := case
    when v_earned_30d = 0 then 0
    else least((v_saved_30d * 100 / v_earned_30d), 100)
  end;

  -- ③ 만족 지연 지수: 활성 저금통 최초 생성 이후 경과 일수 × 3 (최대 100)
  select coalesce(extract(day from now() - min(created_at))::int, 0)
  into v_goal_days
  from savings_goals
  where child_id = p_child_id
    and status = 'active';

  v_delay_score := least(v_goal_days * 3, 100);

  -- child_stats 업데이트
  update child_stats set
    eq_routine_rate = v_routine_rate,
    eq_save_ratio   = v_save_ratio,
    eq_delay_score  = v_delay_score,
    updated_at      = now()
  where child_id = p_child_id;
end;
$$;
