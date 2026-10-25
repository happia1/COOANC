-- Preserve stored dates and rewards; align only the text day comparison and assignment.
create or replace function public.complete_mission_reward(
  p_child_id       uuid,
  p_credit         int,
  p_heart          int,
  p_exp            int,
  p_completion_day date,
  p_advance_boat   boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v            child_stats%rowtype;
  new_exp      int;
  new_level    int;
  next_need    numeric;
  new_streak   int;
  boat_sec     int;
  boat_stp     int;
  boat_moved   boolean := false;
  -- 053 stores this day as YYYY-MM-DD text; last_mission_date remains a date.
  completion_day_text text := to_char(p_completion_day, 'YYYY-MM-DD');
begin
  select * into v from child_stats where child_id = p_child_id for update;
  if not found then
    return null;
  end if;

  -- 스트릭: 같은 날 두 번째 완료는 유지, 어제에 이어지면 +1, 끊겼으면 1
  new_streak := v.streak_days;
  if v.last_mission_date is distinct from p_completion_day then
    if v.last_mission_date = p_completion_day - 1 then
      new_streak := v.streak_days + 1;
    else
      new_streak := 1;
    end if;
  end if;

  -- 레벨업: 보상이 커서 여러 칸을 넘겨도 한 번에 정확히 반영
  new_exp   := v.exp + p_exp;
  new_level := v.current_level;
  next_need := v.exp_to_next_level;
  while next_need > 0 and new_exp >= next_need loop
    new_exp   := new_exp - next_need::int;
    new_level := new_level + 1;
    next_need := greatest(1, round(next_need * 1.5));
  end loop;

  -- 배 이동: 하루 1회 게이트 (완료율 90% 판정은 API 가 계산해 p_advance_boat 로 전달)
  boat_sec := coalesce(v.boat_section, 0);
  boat_stp := coalesce(v.boat_step, 0);
  if p_advance_boat and v.last_hearts_full_date is distinct from completion_day_text then
    boat_moved := true;
    boat_stp := boat_stp + 1;
    if boat_stp >= 5 and boat_sec < 3 then
      boat_sec := boat_sec + 1;
      boat_stp := 0;
    elsif boat_stp >= 5 then
      boat_stp := 4; -- 마지막 섹션 마지막 칸에서 고정
    end if;
  end if;

  update child_stats set
    credits              = credits + p_credit,
    credits_wallet       = 0,
    hearts               = hearts + p_heart,
    total_credits_earned = total_credits_earned + p_credit,
    exp                  = new_exp,
    current_level        = new_level,
    exp_to_next_level    = next_need::int,
    streak_days          = new_streak,
    longest_streak       = greatest(longest_streak, new_streak),
    last_mission_date    = p_completion_day,
    promotion_pending    = false,
    promotion_eligible_at = null,
    boat_section         = case when boat_moved then boat_sec else boat_section end,
    boat_step            = case when boat_moved then boat_stp else boat_step end,
    last_hearts_full_date = case when boat_moved then completion_day_text else last_hearts_full_date end,
    updated_at           = now()
  where child_id = p_child_id
  returning * into v;

  /**
   * 여기서 EQ 를 다시 계산합니다 — 보상이 이미 반영된 «뒤» 입니다.
   * 예전에는 mission_logs 트리거가 이걸 보상 «전» 에 실행해서, 옛 크레딧이 화면으로
   * 다시 새어 나갔습니다(숫자가 오르내림). 순서만 바로잡으면 그 통로가 사라집니다.
   */
  perform recalculate_eq(p_child_id);

  return jsonb_build_object(
    'credits',              v.credits,
    'hearts',               v.hearts,
    'exp',                  v.exp,
    'current_level',        v.current_level,
    'exp_to_next_level',    v.exp_to_next_level,
    'streak_days',          v.streak_days,
    'total_credits_earned', v.total_credits_earned,
    'boat_advanced',        boat_moved
  );
end;
$$;
