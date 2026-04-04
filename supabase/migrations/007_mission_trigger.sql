-- ============================================================
-- 007_mission_trigger.sql
-- 미션 완료 트리거 — 크레딧/하트/EXP 자동 처리
-- (보안 핵심: 프론트에서 child_stats 직접 UPDATE 금지)
-- ============================================================

create or replace function on_mission_completed()
returns trigger language plpgsql security definer as $$
declare
  v_mission missions%rowtype;
  v_stats   child_stats%rowtype;
begin
  -- is_completed: false → true 전환 시에만 처리
  if new.is_completed = true and old.is_completed = false then

    -- 미션 보상 조회
    select * into v_mission from missions where id = new.mission_id;

    -- 로그에 실제 지급 보상 기록 (트리거가 직접 세팅)
    new.credit_earned := v_mission.credit_reward;
    new.heart_earned  := v_mission.heart_reward;
    new.exp_earned    := v_mission.exp_reward;
    new.completed_at  := now();

    -- child_stats 기본 보상 반영
    update child_stats set
      credits              = credits + v_mission.credit_reward,
      hearts               = hearts  + v_mission.heart_reward,
      exp                  = exp     + v_mission.exp_reward,
      total_credits_earned = total_credits_earned + v_mission.credit_reward,
      last_mission_date    = current_date,
      updated_at           = now()
    where child_id = new.child_id;

    -- 스트릭 갱신
    select * into v_stats from child_stats where child_id = new.child_id;

    if v_stats.last_mission_date = current_date - interval '1 day' then
      -- 어제 이어서 달성 → streak 증가
      update child_stats set
        streak_days    = streak_days + 1,
        longest_streak = greatest(longest_streak, streak_days + 1)
      where child_id = new.child_id;

    elsif v_stats.last_mission_date < current_date - interval '1 day'
       or v_stats.last_mission_date is null then
      -- 연속 끊김 → 1로 초기화
      update child_stats set
        streak_days = 1
      where child_id = new.child_id;
    end if;
    -- (오늘 이미 다른 미션을 완료한 경우는 streak 유지, 별도 처리 불필요)

    -- 레벨업 판정 (exp_to_next_level 도달 시)
    select * into v_stats from child_stats where child_id = new.child_id;

    if v_stats.exp >= v_stats.exp_to_next_level and v_stats.current_level < 5 then
      update child_stats set
        current_level         = current_level + 1,
        exp                   = exp - exp_to_next_level,
        exp_to_next_level     = exp_to_next_level * 2,
        promotion_pending     = true,
        promotion_eligible_at = now()
      where child_id = new.child_id;
    end if;

  end if;

  return new;
end;
$$;

create trigger mission_completed_trigger
  before update on mission_logs
  for each row execute procedure on_mission_completed();
