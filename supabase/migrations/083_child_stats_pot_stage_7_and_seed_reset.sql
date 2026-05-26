-- ============================================================
-- 083_child_stats_pot_stage_7_and_seed_reset.sql
-- 화분 단계 상한 버그 수정 + 전원 씨앗(0단계)으로 초기화
--
-- 문제: 069 마이그레이션에서 pot_stage 가 0~6 만 허용되는데,
--       앱(plantTrees.ts)은 0~7(씨앗~다 익은 열매) 8단계를 씁니다.
--       6→7 단계 저장 시 DB 가 거절해 막대만 꽉 차고 단계가 멈춘 것처럼 보일 수 있습니다.
--
-- 조치:
--   1) pot_stage 체크 제약을 0~7 로 교체
--   2) 모든 자녀 행의 화분 진행만 씨앗으로 되돌림 (hearts 등 다른 컬럼은 그대로)
-- 비개발자: 식물 그림이 다시 「씨앗」부터 시작하게 숫자를 맞춥니다. 받은 하트 개수는 안 바꿉니다.
-- ============================================================

-- ── 1) 기존 pot_stage 관련 CHECK 제약 제거 (이름이 환경마다 다를 수 있어 동적으로 찾습니다)
do $$
declare
  con record;
begin
  for con in
    select c.conname::text as conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'child_stats'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%pot_stage%'
  loop
    execute format('alter table public.child_stats drop constraint %I', con.conname);
  end loop;
end $$;

-- ── 2) 0~7 단계 허용 (앱의 PlantStage 와 일치)
alter table public.child_stats
  add constraint child_stats_pot_stage_range_check
  check (pot_stage >= 0 and pot_stage <= 7);

comment on column public.child_stats.pot_stage is '화분 성장 단계 0~7 (씨앗~다 익은 열매)';

-- ── 3) 화분 진행만 초기화 — 애정 하트·크레딧 등은 유지
update public.child_stats
set
  pot_stage = 0,
  pot_hearts_used = 0,
  pot_completed = false;
