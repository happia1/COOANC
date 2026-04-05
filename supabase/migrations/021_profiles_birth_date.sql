-- 자녀 온보딩 시 생년월일 저장 → 앱에서 만 나이(생일 지난 기준 연령)를 계산합니다.
-- 기존 age 컬럼은 호환·검색용으로 유지하고, birth_date 가 있으면 UI는 생일 기준으로 나이를 표시합니다.

alter table public.profiles
  add column if not exists birth_date date;

comment on column public.profiles.birth_date is '자녀 생년월일 (YYYY-MM-DD). age 와 함께 쓰이며 표시는 생일 기준 만 나이 우선.';
