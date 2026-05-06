-- ============================================================
-- 072_missions_sort_order.sql
-- 부모가 루틴 탭에서 미션 카드 순서를 저장합니다.
-- 같은 시간대(블록) 안에서는 sort_order 가 칩 기본 순위보다 우선합니다.
-- ============================================================

alter table public.missions
  add column if not exists sort_order integer not null default 0;

comment on column public.missions.sort_order is
  '부모가 자녀 전용 루틴에서 지정한 표시 순서(같은 블록 내 정렬). 0이면 기존 칩·시간 순 적용.';

create index if not exists idx_missions_linked_child_sort
  on public.missions (linked_child_id, sort_order);

notify pgrst, 'reload schema';
