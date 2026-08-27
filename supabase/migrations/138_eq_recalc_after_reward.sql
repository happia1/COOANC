-- ============================================================
-- 138_eq_recalc_after_reward.sql
-- 미션 카드를 누르면 크레딧이 「올랐다 내렸다」 하던 문제의 근본 원인 제거
--
-- 비개발자 설명:
--   카드를 한 번 누르면 child_stats(크레딧이 들어 있는 표)가 **두 번** 저장되고 있었습니다.
--
--     ① mission_logs 에 완료 기록을 남김
--        → 042 에서 만든 트리거 `trg_mission_logs_recalc_eq` 가 자동으로 깨어나
--          `recalculate_eq()` 를 실행하고, 그 함수는 끝에서 child_stats 를 저장합니다.
--        → **이 시점에는 아직 보상이 더해지기 전**이라, 저장된 값은 옛 크레딧입니다.
--     ② 그 다음에야 보상 함수(complete_mission_reward)가 크레딧을 더해 저장합니다.
--
--   저장될 때마다 자녀 화면에 실시간 알림이 갑니다. 그래서 화면에서는
--   「보상 반영 → 옛 값으로 뚝 떨어짐 → 다시 새 값」 순으로 숫자가 튀었습니다.
--
--   지금까지는 화면 쪽에서 "방금 저장한 직후 몇 초 동안은 돈 관련 값을 무시"하는 식으로
--   막아 왔는데, ① 은 «오래된 알림»이 아니라 그 순간 진짜 최신 상태라서 시간 비교로는
--   걸러지지 않습니다. 서버가 느려지면 그 시간 창을 벗어나 다시 새어 나옵니다.
--
--   그래서 순서를 바로잡습니다: EQ 재계산은 **보상이 다 끝난 뒤**에 실행합니다.
--   그러면 저장되는 크레딧이 항상 최신이라 숫자가 되돌아갈 일이 없습니다.
--
--   덤으로 미션 저장이 빨라집니다. 예전에는 완료 기록을 남기는 그 순간에
--   «최근 14일 미션 집계»까지 같이 돌아서 저장이 끝날 때까지 기다려야 했습니다.
-- ============================================================

-- ── ⓪ 잠금 대기 상한 ────────────────────────────────────────
-- 아래 `drop trigger` 는 mission_logs 에 «배타 잠금»을 겁니다. 자녀 앱이 켜져 있어
-- 그 순간 미션을 저장 중이면 서로 기다리다 교착(deadlock)이 날 수 있습니다.
-- 5초 안에 못 잡으면 그냥 실패하게 두고, 잠시 뒤 다시 실행하는 편이 안전합니다.
-- (실패해도 아무것도 바뀌지 않으니 그대로 다시 돌리면 됩니다.)
set local lock_timeout = '5s';

-- ── ① mission_logs 트리거 제거 ──────────────────────────────
-- 이 트리거가 «보상 전» child_stats 저장을 일으키던 주범입니다.
drop trigger if exists trg_mission_logs_recalc_eq on public.mission_logs;
drop function if exists public.trg_mission_logs_recalc_eq_fn();

-- ── ② 보상 함수 끝에서 EQ 를 다시 계산 ──────────────────────
-- 121 의 정의를 그대로 유지하고, 마지막에 recalculate_eq 호출만 더합니다.
-- 같은 트랜잭션 안에서 보상 반영 «뒤»에 실행되므로, 저장되는 크레딧은 항상 최신입니다.
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
  if p_advance_boat and v.last_hearts_full_date is distinct from p_completion_day then
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
    last_hearts_full_date = case when boat_moved then p_completion_day else last_hearts_full_date end,
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

-- ── ③ 되돌리기 경로에서도 EQ 를 맞출 수 있게 실행 권한 부여 ──
-- 트리거가 사라졌으므로, 미션을 되돌린 뒤에는 앱이 직접 이 함수를 부릅니다.
grant execute on function public.recalculate_eq(uuid) to authenticated, service_role;

-- ── ④ 기존 행 일괄 재계산은 **일부러 넣지 않습니다** ────────
--
-- 처음엔 여기에 「모든 자녀를 돌며 recalculate_eq 실행」 반복문을 넣었는데,
-- 그게 교착(deadlock)을 일으켰습니다. 이유:
--   Supabase SQL Editor 는 스크립트 전체를 한 트랜잭션으로 실행합니다.
--   그래서 위 ① 이 잡은 mission_logs 배타 잠금을 **반복문이 끝날 때까지 계속 쥔 채**
--   자녀들을 하나씩 돌게 되고, 그사이 자녀 앱이 미션을 저장하려 하면 서로 물립니다.
--
-- 그리고 굳이 필요하지도 않습니다. EQ 값은 다음 미션 완료 때 자연히 다시 계산됩니다.
-- 그래도 지금 당장 전부 맞추고 싶다면, **자녀 앱을 모두 닫은 뒤** 아래를 따로 실행하세요.
--
--   do $$
--   declare r record;
--   begin
--     for r in select child_id from child_stats loop
--       perform recalculate_eq(r.child_id);
--     end loop;
--   end $$;
