-- 한국천문연구원 특일(공휴일) API 연동 저장소
-- 비개발자: "대한민국 공휴일 목록"을 한 번 받아 두고 앱에서 달력·루틴에 씁니다.
-- 컬럼: id, date, name, year, created_at (date 는 SQL 예약어와 겹치지 않게 따옴표로 정의)

-- 연도별 동기화가 끝났는지 표시(같은 해에 API 를 여러 번 두드리지 않게 함)
create table if not exists public.public_holiday_sync_log (
  year int primary key,
  synced_at timestamptz not null default now(),
  row_count int not null default 0
);

comment on table public.public_holiday_sync_log is '특일 API 연도별 1회 동기화 여부';

create table if not exists public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  "date" date not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (year, "date")
);

comment on table public.public_holidays is '공공데이터포털 특일 정보(getHoliDeInfo) 캐시';

create index if not exists public_holidays_date_idx on public.public_holidays ("date");
create index if not exists public_holidays_year_idx on public.public_holidays (year);

alter table public.public_holidays enable row level security;

drop policy if exists "public_holidays_select_anon" on public.public_holidays;
create policy "public_holidays_select_anon"
  on public.public_holidays
  for select
  to anon, authenticated
  using (true);

alter table public.public_holiday_sync_log enable row level security;

drop policy if exists "public_holiday_sync_log_select" on public.public_holiday_sync_log;
create policy "public_holiday_sync_log_select"
  on public.public_holiday_sync_log
  for select
  to anon, authenticated
  using (true);
