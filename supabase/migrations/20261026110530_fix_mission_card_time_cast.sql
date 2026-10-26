create or replace function public.prepare_child_mission_cards(p_day date,p_child_id uuid default null)
returns integer language plpgsql security invoker set search_path=public as $$
declare inserted integer;
begin
  with children as (
    select s.child_id,s.current_level,p.holiday_routine_mode,
      coalesce(case when o.routine_type='weekday' then 'weekday' when o.routine_type in ('weekend','holiday') then 'weekend' end,
        case when extract(isodow from p_day) in (6,7) then 'weekend' else 'weekday' end) as routine
    from child_stats s join profiles p on p.id=s.child_id and p.role='child'
    left join daily_routine_overrides o on o.child_id=s.child_id and o.routine_date=p_day
    where p_child_id is null or s.child_id=p_child_id
  ), eligible as (
    select c.*,m.id,m.scheduled_time,m.repeat_type,m.difficulty,
      bool_or(m.repeat_type='weekly' and m.difficulty<>'special') over(partition by c.child_id) as has_weekly
    from children c join missions m on m.linked_child_id=c.child_id
    where m.is_active and m.level_required<=c.current_level and m.repeat_type<>'event'
  )
  insert into daily_missions(child_id,mission_template_id,date,scheduled_time,routine_type)
    select child_id,id,p_day,nullif(scheduled_time,'')::time,routine from eligible
    where (difficulty='special' and repeat_type='daily')
      or (difficulty<>'special' and repeat_type=case when routine='weekday' then 'daily'
          when routine='weekend' and holiday_routine_mode='custom' then 'weekly'
          when has_weekly then 'weekly' else 'daily' end)
    on conflict(child_id,mission_template_id,date) do nothing;
  get diagnostics inserted=row_count;
  return inserted;
end $$;
