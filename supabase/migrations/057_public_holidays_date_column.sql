-- 예전 056(holiday_date, is_holiday 등)만 적용된 DB → 컬럼명 date 및 스키마 정리
-- 새로 056만 적용한 환경에서는 이 파일의 DO 블록이 아무 것도 하지 않습니다.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_holidays' and column_name = 'holiday_date'
  ) then
    alter table public.public_holidays rename column holiday_date to "date";
    alter table public.public_holidays drop column if exists is_holiday;
    alter table public.public_holidays drop column if exists updated_at;
  end if;
end $$;

drop index if exists public.public_holidays_holiday_date_idx;
create index if not exists public_holidays_date_idx on public.public_holidays ("date");
