-- ============================================================
-- 131_parent_onboarding_acks.sql
--
-- 부모에게 「한 번만」 보여 주는 안내 팝업의 확인 상태를 저장합니다.
--
-- 첫 사용처: 가입 직후 뜨는 시작 안내 팝업
--   (미션·마켓·화분은 레벨 0부터 열려 있어 레벨업 팝업으로는 영영 안내되지 않습니다.
--    그래서 처음 한 번은 별도 팝업으로 사용법을 보여 줍니다.)
--
-- `onboarding_key` 로 구분하므로, 앞으로 다른 1회성 안내가 생겨도
-- 테이블을 새로 만들지 않고 키만 추가하면 됩니다.
--
-- 기기별 localStorage 가 아니라 DB 인 이유:
--   노트북에서 확인했는데 폰에서 또 뜨는 일을 막기 위해서입니다.
--
-- 실행 후 확인:
--   select * from public.parent_onboarding_acks;
-- ============================================================

create table if not exists public.parent_onboarding_acks (
  parent_id      uuid        not null references public.profiles(id) on delete cascade,
  /** 안내 종류 식별자 — 예: 'welcome_basics_v1' */
  onboarding_key text        not null,
  acked_at       timestamptz not null default now(),
  primary key (parent_id, onboarding_key)
);

alter table public.parent_onboarding_acks enable row level security;

drop policy if exists "parent_onboarding_acks_self" on public.parent_onboarding_acks;
create policy "parent_onboarding_acks_self"
  on public.parent_onboarding_acks for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

notify pgrst, 'reload schema';
