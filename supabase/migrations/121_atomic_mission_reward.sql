-- ============================================================
-- 121_atomic_mission_reward.sql
-- 미션 완료 보상 원자화 — 연타 시 크레딧/하트 손실(Lost Update) 수정
--
-- 문제: /api/daily-mission/complete 가 child_stats 를 먼저 읽고(peek)
--   절대값으로 UPDATE (credits = 읽은값 + 보상). 동시 요청 N건이 같은
--   잔액을 읽으면 마지막 쓰기만 살아남아 보상이 유실됨 (3장 연타 → +30 대신 +10).
--
-- 해결: 행 잠금(SELECT ... FOR UPDATE) 안에서 증가·레벨업·스트릭을 모두 계산.
--   동시 요청은 자동으로 직렬화되어 보상이 전부 반영됨.
--   레벨업 공식은 API 와 동일: exp_to_next_level 초과 시 레벨+1, 다음 필요치 = max(1, round(×1.5))
-- ============================================================

CREATE OR REPLACE FUNCTION complete_mission_reward(
  p_child_id       uuid,
  p_credit         int,
  p_heart          int,
  p_exp            int,
  p_completion_day date,
  p_advance_boat   boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v            child_stats%rowtype;
  new_exp      int;
  new_level    int;
  next_need    numeric;
  new_streak   int;
  boat_sec     int;
  boat_stp     int;
  boat_moved   boolean := false;
BEGIN
  SELECT * INTO v FROM child_stats WHERE child_id = p_child_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 스트릭: 같은 날 두 번째 완료는 유지, 어제에 이어지면 +1, 끊겼으면 1
  new_streak := v.streak_days;
  IF v.last_mission_date IS DISTINCT FROM p_completion_day THEN
    IF v.last_mission_date = p_completion_day - 1 THEN
      new_streak := v.streak_days + 1;
    ELSE
      new_streak := 1;
    END IF;
  END IF;

  -- 레벨업: 보상이 커서 여러 칸을 넘겨도 한 번에 정확히 반영 (API 와 동일 공식)
  new_exp   := v.exp + p_exp;
  new_level := v.current_level;
  next_need := v.exp_to_next_level;
  WHILE next_need > 0 AND new_exp >= next_need LOOP
    new_exp   := new_exp - next_need::int;
    new_level := new_level + 1;
    next_need := GREATEST(1, ROUND(next_need * 1.5));
  END LOOP;

  -- 배 이동: 하루 1회 게이트 (완료율 90% 판정은 API 가 계산해 p_advance_boat 로 전달)
  boat_sec := COALESCE(v.boat_section, 0);
  boat_stp := COALESCE(v.boat_step, 0);
  IF p_advance_boat AND v.last_hearts_full_date IS DISTINCT FROM p_completion_day THEN
    boat_moved := true;
    boat_stp := boat_stp + 1;
    IF boat_stp >= 5 AND boat_sec < 3 THEN
      boat_sec := boat_sec + 1;
      boat_stp := 0;
    ELSIF boat_stp >= 5 THEN
      boat_stp := 4; -- 마지막 섹션 마지막 칸에서 고정
    END IF;
  END IF;

  UPDATE child_stats SET
    credits              = credits + p_credit,
    credits_wallet       = 0,
    hearts               = hearts + p_heart,
    total_credits_earned = total_credits_earned + p_credit,
    exp                  = new_exp,
    current_level        = new_level,
    exp_to_next_level    = next_need::int,
    streak_days          = new_streak,
    longest_streak       = GREATEST(longest_streak, new_streak),
    last_mission_date    = p_completion_day,
    promotion_pending    = false,
    promotion_eligible_at = NULL,
    boat_section         = CASE WHEN boat_moved THEN boat_sec ELSE boat_section END,
    boat_step            = CASE WHEN boat_moved THEN boat_stp ELSE boat_step END,
    last_hearts_full_date = CASE WHEN boat_moved THEN p_completion_day ELSE last_hearts_full_date END,
    updated_at           = now()
  WHERE child_id = p_child_id
  RETURNING * INTO v;

  RETURN jsonb_build_object(
    'credits',              v.credits,
    'hearts',               v.hearts,
    'exp',                  v.exp,
    'current_level',        v.current_level,
    'exp_to_next_level',    v.exp_to_next_level,
    'streak_days',          v.streak_days,
    'total_credits_earned', v.total_credits_earned,
    'boat_advanced',        boat_moved
  );
END;
$$;
