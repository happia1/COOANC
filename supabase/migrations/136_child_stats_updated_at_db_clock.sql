-- ============================================================
-- 136_child_stats_updated_at_db_clock.sql
-- child_stats.updated_at 을 **항상 DB 시계(now())** 로 통일합니다.
--
-- 왜 필요한가(비개발자 설명):
--   자녀 화면은 "저장 시각"을 비교해서, 뒤늦게 도착한 옛 알림이 최신 크레딧을
--   과거 값으로 되돌리는 것을 막습니다.
--   그런데 이 시각을 쓰는 주체가 두 곳이었습니다.
--     • 앱 서버(Next.js): 마켓 결제·저금통 옮기기 등에서 자기 시계로 기록
--     • 데이터베이스: 미션 보상·보너스 받기·EQ 재계산 등에서 now() 로 기록
--   두 시계가 조금만 어긋나도 "더 나중에 저장한 값"이 숫자상 과거로 보여,
--   비교가 거꾸로 동작할 수 있습니다.
--
--   이 트리거를 넣으면 누가 저장하든 저장 직전에 DB 시계로 덮어써서
--   시각이 한 가지 기준으로 통일됩니다. (앱이 보내는 값은 무시됩니다.)
-- ============================================================

create or replace function public.child_stats_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.child_stats_set_updated_at() is
  'child_stats 저장 시각을 항상 DB 시계(now())로 맞춥니다 — 앱 시계와 섞이지 않게.';

drop trigger if exists trg_child_stats_set_updated_at on public.child_stats;
create trigger trg_child_stats_set_updated_at
  before update on public.child_stats
  for each row
  execute function public.child_stats_set_updated_at();
