-- 공휴일 연도 단위 동기화: PostgREST bulk insert + 예약어 컬럼 `date` 이슈를 피하기 위해 서버에서 DELETE + INSERT 수행
-- 비개발자: API 라우트가 이 함수만 부르면 한 연도 치가 한 번에 갈아끼워집니다.

create or replace function public.replace_public_holidays_for_year(p_year int, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.public_holidays where year = p_year;
  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    return;
  end if;
  insert into public.public_holidays (year, "date", name)
  select
    (r->>'year')::int,
    (r->>'date')::date,
    coalesce(r->>'name', '')
  from jsonb_array_elements(p_rows) as r;
end;
$$;

comment on function public.replace_public_holidays_for_year(int, jsonb) is '연도별 공휴일 행 전체 교체(특일 API 동기화)';

revoke all on function public.replace_public_holidays_for_year(int, jsonb) from public;
grant execute on function public.replace_public_holidays_for_year(int, jsonb) to service_role;
