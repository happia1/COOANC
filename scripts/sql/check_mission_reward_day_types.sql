-- Run as an administrator. All test writes are rolled back inside the exception block.
DO $test$
DECLARE
  original public.child_stats%ROWTYPE;
  result jsonb;
  day date := date '2026-10-25';
BEGIN
  BEGIN
    SELECT * INTO STRICT original FROM public.child_stats ORDER BY child_id LIMIT 1 FOR UPDATE;
    UPDATE public.child_stats SET last_hearts_full_date = NULL, boat_section = 0, boat_step = 0
      WHERE child_id = original.child_id;
    result := public.complete_mission_reward(original.child_id, 1, 1, 0, day, false);
    ASSERT (result->>'credits')::int = original.credits + 1, 'credit increment failed';
    ASSERT (result->>'hearts')::int = original.hearts + 1, 'heart increment failed';
    ASSERT (result->>'boat_advanced')::boolean = false, 'unexpected boat advance';
    result := public.complete_mission_reward(original.child_id, 0, 0, 0, day, true);
    ASSERT (result->>'boat_advanced')::boolean = true, 'first advance failed';
    ASSERT (SELECT last_hearts_full_date = '2026-10-25' FROM public.child_stats WHERE child_id = original.child_id), 'text day not stored';
    result := public.complete_mission_reward(original.child_id, 0, 0, 0, day, true);
    ASSERT (result->>'boat_advanced')::boolean = false, 'duplicate same-day advance';
    result := public.complete_mission_reward(original.child_id, 0, 0, 0, day + 1, true);
    ASSERT (result->>'boat_advanced')::boolean = true, 'next-day advance failed';
    RAISE SQLSTATE 'ZX001' USING MESSAGE = 'rollback successful self-check';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  ASSERT (SELECT to_jsonb(s) = to_jsonb(original) FROM public.child_stats s WHERE child_id = original.child_id), 'self-check changed data';
END;
$test$;
