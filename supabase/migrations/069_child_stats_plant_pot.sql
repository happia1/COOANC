-- ============================================================
-- 069_child_stats_plant_pot.sql
-- 화분(식물 성장) — 단계·하트 소모·완성 플래그·나무 종류
-- 비개발자 설명: 아이가 「물 주기」로 모은 하트를 쓰면 단계가 올라가고,
--               DB에 현재 단계와 그 단계에서 쓴 하트 수가 저장됩니다.
-- ============================================================

alter table public.child_stats
  add column if not exists pot_stage int not null default 0
    check (pot_stage >= 0 and pot_stage <= 6);

alter table public.child_stats
  add column if not exists pot_hearts_used int not null default 0
    check (pot_hearts_used >= 0);

alter table public.child_stats
  add column if not exists pot_completed boolean not null default false;

alter table public.child_stats
  add column if not exists pot_tree_id text not null default 'apple';

comment on column public.child_stats.pot_stage is '화분 성장 단계 0~6 (씨앗~완성)';
comment on column public.child_stats.pot_hearts_used is '현재 단계에서 물주기로 소모한 하트 누적';
comment on column public.child_stats.pot_completed is '6단계(완성) 도달 후 씨앗 선택 전 true';
comment on column public.child_stats.pot_tree_id is '심은 나무 종류 코드 (예: apple) — 종류 늘리기용';
