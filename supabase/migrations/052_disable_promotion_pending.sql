-- ============================================================
-- 052_disable_promotion_pending.sql
-- 레벨업 시 켜던 promotion_pending 은 「부모 승인 대기」 UX 용이었으나
-- 부모 앱에서 끄는 흐름이 없어 자녀 화면에만 안내가 남는 문제가 있었습니다.
-- 레벨은 즉시 반영되므로 플래그를 쓰지 않고, 기존 true 행도 정리합니다.
-- ============================================================

create or replace function on_mission_completed()
returns trigger language plpgsql security definer as $$
declare
  v_mission missions%rowtype;
  v_stats   child_stats%rowtype;
begin
  if new.is_completed = true and old.is_completed = false then

    select * into v_mission from missions where id = new.mission_id;

    new.credit_earned := v_mission.credit_reward;
    new.heart_earned  := v_mission.heart_reward;
    new.exp_earned    := v_mission.exp_reward;
    new.completed_at  := now();

    update child_stats set
      credits              = credits + v_mission.credit_reward,
      hearts               = hearts  + v_mission.heart_reward,
      exp                  = exp     + v_mission.exp_reward,
      total_credits_earned = total_credits_earned + v_mission.credit_reward,
      last_mission_date    = current_date,
      updated_at           = now()
    where child_id = new.child_id;

    select * into v_stats from child_stats where child_id = new.child_id;

    if v_stats.last_mission_date = current_date - interval '1 day' then
      update child_stats set
        streak_days    = streak_days + 1,
        longest_streak = greatest(longest_streak, streak_days + 1)
      where child_id = new.child_id;

    elsif v_stats.last_mission_date < current_date - interval '1 day'
       or v_stats.last_mission_date is null then
      update child_stats set
        streak_days = 1
      where child_id = new.child_id;
    end if;

    select * into v_stats from child_stats where child_id = new.child_id;

    if v_stats.exp >= v_stats.exp_to_next_level and v_stats.current_level < 5 then
      update child_stats set
        current_level     = current_level + 1,
        exp               = exp - exp_to_next_level,
        exp_to_next_level = exp_to_next_level * 2,
        promotion_pending = false,
        promotion_eligible_at = null
      where child_id = new.child_id;
    end if;

  end if;

  return new;
end;
$$;

update child_stats
set
  promotion_pending = false,
  promotion_eligible_at = null
where promotion_pending is true;
