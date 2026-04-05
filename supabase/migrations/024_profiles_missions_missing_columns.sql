-- ============================================================
-- [COOANC] PostgREST schema cache / 미션 생성 실패 대응
-- 코드·API가 profiles.age, missions.block 등을 참조하는데
-- 원격 Supabase 에 016·20240406 마이그레이션이 없으면 컬럼이 없어 에러가 납니다.
-- IF NOT EXISTS 로 여러 번 실행해도 안전합니다.
-- ============================================================

-- profiles: 누락 컬럼 (016·021·20240406 과 겹치는 항목은 IF NOT EXISTS 로 무해)
alter table public.profiles
  add column if not exists age integer check (age >= 1 and age <= 18),
  add column if not exists birth_date date,
  add column if not exists age_group text check (age_group in ('preschool', 'school')),
  add column if not exists institution_type text check (
    institution_type in ('home', 'daycare', 'kindergarten', 'school')
  ),
  add column if not exists academies jsonb default '[]'::jsonb,
  add column if not exists wake_time time,
  add column if not exists sleep_time time,
  add column if not exists alarm_enabled boolean default false;

-- missions: 누락 컬럼 (루틴 온보딩 /api/mission/create 가 block·scheduled_time 사용)
alter table public.missions
  add column if not exists block text check (block in ('morning', 'afternoon', 'evening', 'bedtime')),
  add column if not exists scheduled_time time,
  add column if not exists scope text check (scope in ('weekday', 'weekend', 'both')) default 'both';
