-- 온보딩·루틴에서 만든 미션을 특정 자녀에 묶습니다. 자녀 프로필 삭제 시 해당 행만 CASCADE 로 함께 삭제됩니다.
-- NULL 인 행은 기존 전역(시드) 미션과 동일하게 모든 자녀에게 표시됩니다.

alter table public.missions
  add column if not exists linked_child_id uuid references public.profiles(id) on delete cascade;

create index if not exists idx_missions_linked_child_id on public.missions(linked_child_id);

comment on column public.missions.linked_child_id is '이 미션 템플릿을 만든/귀속된 자녀. 삭제 시 미션 행도 제거. NULL 이면 공용 풀.';
