-- ============================================================
-- 130_parent_child_level_guide_ack.sql
--
-- 부모 홈 「자녀 레벨 안내」 블록의 닫기(X) 상태를 저장합니다.
--
-- 동작:
--   - 부모가 X 를 누르면 「그 자녀의 그 레벨 안내를 봤다」로 기록합니다.
--   - 자녀가 다음 레벨로 올라가면 새 안내가 다시 뜹니다(새 레벨 = 새 안내).
--   - 닫은 뒤에도 상단 알림창(공지센터)에서는 계속 볼 수 있습니다(화면 조건일 뿐 데이터는 그대로).
--
-- 기기별 localStorage 가 아니라 DB 에 두는 이유:
--   노트북에서 닫았는데 폰에서 다시 뜨는 일을 막기 위해서입니다.
--
-- 실행 후 확인:
--   select * from public.parent_child_level_guide_acks;
-- ============================================================

create table if not exists public.parent_child_level_guide_acks (
  parent_id      uuid        not null references public.profiles(id) on delete cascade,
  child_id       uuid        not null references public.profiles(id) on delete cascade,
  /** 부모가 닫기(X)를 누른 시점의 자녀 레벨 — 이보다 높은 레벨이 되면 다시 표시합니다 */
  dismissed_level int        not null default 0,
  dismissed_at   timestamptz not null default now(),
  primary key (parent_id, child_id)
);

alter table public.parent_child_level_guide_acks enable row level security;

drop policy if exists "parent_child_level_guide_acks_self" on public.parent_child_level_guide_acks;
create policy "parent_child_level_guide_acks_self"
  on public.parent_child_level_guide_acks for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

notify pgrst, 'reload schema';
