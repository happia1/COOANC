-- 스페셜 미션 완료 시 크레딧·하트·EXP에 곱해 적용할 배율 (1=기본, 2·3=보너스)
alter table public.missions
  add column if not exists reward_multiplier smallint not null default 1;

update public.missions
set reward_multiplier = 1
where reward_multiplier is null;

alter table public.missions
  drop constraint if exists missions_reward_multiplier_check;

alter table public.missions
  add constraint missions_reward_multiplier_check
  check (reward_multiplier in (1, 2, 3));

comment on column public.missions.reward_multiplier is
  '완료 보상 배율: 1 기본, 2·3 부모가 스페셜 미션에서 설정한 보너스';
