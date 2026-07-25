-- ============================================================
-- 124_reload_schema_for_routine_alarm_prefs.sql
-- 알람 기기 간 동기화가 여전히 안 되는 원인 수정
--
-- 문제: 123 마이그레이션으로 child_stats.routine_alarm_prefs 컬럼은 실제로 생겼지만
--   (information_schema 조회 시 보임), 123 에는 이 저장소의 다른 마이그레이션들과 달리
--   `notify pgrst, 'reload schema';` 가 빠져 있었습니다.
--   그래서 Supabase API(PostgREST)의 스키마 캐시에는 이 컬럼이 등록되지 않았고,
--   앱에서 보내는
--     .update({ routine_alarm_prefs: ... })  /  .select('routine_alarm_prefs, ...')
--   요청이 "컬럼 없음" 으로 실패했습니다.
--   저장 실패는 console.warn 으로만 남고, 읽기 실패는 통째로 return 되어
--   결국 모든 기기가 각자의 localStorage 값을 계속 쓰게 됐습니다
--   (= 모바일·태블릿·노트북 알람이 서로 다름).
--
-- 해결: PostgREST 스키마 캐시를 다시 읽게 합니다. 컬럼 자체는 그대로 두고
--   (123 은 ADD COLUMN IF NOT EXISTS 라 재실행해도 안전) 캐시만 갱신합니다.
--
-- 실행 후 확인: 부모 앱에서 알람을 저장한 뒤
--   select child_id, routine_alarm_prefs from public.child_stats
--    where routine_alarm_prefs is not null;
--   → 행이 보이면 정상. 이제 다른 기기에서도 같은 값이 보입니다.
-- ============================================================

ALTER TABLE public.child_stats
  ADD COLUMN IF NOT EXISTS routine_alarm_prefs jsonb;

notify pgrst, 'reload schema';
