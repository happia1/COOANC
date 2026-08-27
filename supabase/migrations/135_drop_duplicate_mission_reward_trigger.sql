-- ============================================================
-- 135_drop_duplicate_mission_reward_trigger.sql
-- 미션 보상을 **두 번** 주던 옛 트리거를 제거합니다.
--
-- 비개발자 설명:
--   미션을 끝냈을 때 크레딧을 더해 주는 곳이 두 군데였습니다.
--     ① 옛 DB 트리거 `mission_completed_trigger` (007 에서 만들고 052 에서 고침)
--     ② 지금 쓰는 API 의 `complete_mission_reward` (121)
--
--   평소(첫 완료)에는 mission_logs 에 새 줄을 넣기 때문에 ① 은 돌지 않아 한 번만 지급됐습니다.
--   그런데 부모가 「되돌리기」를 하거나 아이가 「미안, 다시 할게」(거짓말 방지)를 누르면
--   그 줄이 '미완료'로 바뀌고, 다음에 다시 완료할 때는 **줄을 고치는(UPDATE)** 방식이라
--   ① 트리거가 깨어나 ② 와 함께 크레딧을 **두 번** 더했습니다.
--
--   게다가 ① 은 배수가 적용되지 않은 원래 보상값을 쓰고, 로그의 `credit_earned` 까지
--   그 값으로 덮어써서 되돌릴 때 빼는 금액도 어긋났습니다.
--
--   보상 지급은 ② 한 곳으로만 남깁니다. (되돌리기·배수 계산이 모두 ② 기준입니다.)
-- ============================================================

drop trigger if exists mission_completed_trigger on public.mission_logs;
drop function if exists public.on_mission_completed();
