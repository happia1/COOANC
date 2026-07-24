-- ============================================================
-- 123_child_stats_routine_alarm_prefs.sql
-- 루틴 알람(기상·잘시간·하원 등) 기기 간 동기화
--
-- 문제: 기상·잘 시간·하원 알람의 시각·소리·on/off·주말 설정이 localStorage
--   (cooanc_alarm_prefs 등)에만 저장돼, 부모가 설정한 기기와 다른 기기의 자녀 앱이
--   서로 다른 값을 봄. (등원·잘 준비만 child_stats 컬럼으로 이미 동기화됨)
--
-- 해결: 알람 관련 localStorage 번들 전체를 이 JSON 컬럼에 미러링.
--   부모 시트·온보딩이 저장 시 함께 기록하고, 자녀 앱이 로드 시 localStorage 로 복원.
-- ============================================================

ALTER TABLE public.child_stats
  ADD COLUMN IF NOT EXISTS routine_alarm_prefs jsonb;

COMMENT ON COLUMN public.child_stats.routine_alarm_prefs IS
  '루틴 알람 localStorage 번들(cooanc_alarm_prefs·notify_*·has_school) — 기기 간 동기화용';
