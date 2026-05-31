-- ============================================================
-- 106_content_watch_seconds_pool.sql
--
-- 비개발자 요약:
--   • 이용권 1장 = 30분(1800초) 시청 시간 풀
--   • 뒤로가기해도 남은 시청 시간 유지 · 다른 채널에서도 이어 보기
--   • 채널마다 이용권을 다시 쓰지 않음
-- ============================================================

alter table public.content_tickets
  add column if not exists watch_seconds_remaining int not null default 0
    check (watch_seconds_remaining >= 0);

comment on column public.content_tickets.watch_seconds_remaining is
  '아직 시청 세션으로 옮기지 않은 남은 시청 시간(초).';

update public.content_tickets
set watch_seconds_remaining = quantity * 1800
where watch_seconds_remaining = 0
  and quantity > 0;

alter table public.content_sessions
  add column if not exists remaining_play_seconds int
    check (remaining_play_seconds is null or remaining_play_seconds >= 0);

comment on column public.content_sessions.remaining_play_seconds is
  '활성 시청 세션의 남은 재생 시간(초). 일시정지·뒤로가기 후에도 유지.';

update public.content_sessions
set remaining_play_seconds = duration_minutes * 60
where remaining_play_seconds is null
  and is_active = true;

-- ── 지급: 장 수 + 초 풀 ───────────────────────────────────────
create or replace function public.grant_content_ticket(p_child_id uuid, p_amount int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty int;
  v_add int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;

  v_add := p_amount * 1800;

  insert into public.content_tickets (child_id, quantity, watch_seconds_remaining, updated_at)
  values (p_child_id, p_amount, v_add, now())
  on conflict (child_id) do update
    set quantity = public.content_tickets.quantity + p_amount,
        watch_seconds_remaining = public.content_tickets.watch_seconds_remaining + v_add,
        updated_at = now()
  returning quantity into v_qty;

  return v_qty;
end;
$$;

-- ── 시청 시작/재개 (이용권 1장씩 차감하지 않음) ───────────────
drop function if exists public.start_content_session(uuid, int, text);

create or replace function public.begin_content_viewing(
  p_child_id uuid,
  p_playlist_url text default null
)
returns table(
  session_id uuid,
  remaining_play_seconds int,
  ticket_quantity int,
  watch_seconds_pool int,
  resumed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_id uuid;
  v_active_rem int;
  v_qty int;
  v_pool int;
  v_seconds int;
  v_units int;
begin
  if auth.uid() is distinct from p_child_id
     and not exists (
       select 1 from public.family_links fl
       where fl.parent_id = auth.uid() and fl.child_id = p_child_id
     ) then
    raise exception 'forbidden';
  end if;

  select cs.id,
         coalesce(cs.remaining_play_seconds, cs.duration_minutes * 60)
    into v_active_id, v_active_rem
  from public.content_sessions cs
  where cs.child_id = p_child_id
    and cs.is_active = true
  order by cs.started_at desc
  limit 1
  for update;

  if v_active_id is not null and v_active_rem > 0 then
    if p_playlist_url is not null then
      update public.content_sessions
      set playlist_url = p_playlist_url
      where id = v_active_id;
    end if;

    select coalesce(ct.quantity, 0), coalesce(ct.watch_seconds_remaining, 0)
      into v_qty, v_pool
    from public.content_tickets ct
    where ct.child_id = p_child_id;

    session_id := v_active_id;
    remaining_play_seconds := v_active_rem;
    ticket_quantity := v_qty;
    watch_seconds_pool := v_pool;
    resumed := true;
    return next;
    return;
  end if;

  if v_active_id is not null then
    update public.content_sessions
    set is_active = false
    where id = v_active_id;
  end if;

  select coalesce(ct.quantity, 0), coalesce(ct.watch_seconds_remaining, 0)
    into v_qty, v_pool
  from public.content_tickets ct
  where ct.child_id = p_child_id
  for update;

  v_seconds := v_pool;
  if v_seconds <= 0 then
    raise exception 'no tickets';
  end if;

  v_units := ceil(v_seconds / 1800.0)::int;

  update public.content_tickets
  set watch_seconds_remaining = 0,
      quantity = greatest(0, quantity - v_units),
      updated_at = now()
  where child_id = p_child_id;

  insert into public.content_sessions (
    child_id,
    started_at,
    duration_minutes,
    is_active,
    playlist_url,
    remaining_play_seconds
  )
  values (
    p_child_id,
    now(),
    greatest(1, ceil(v_seconds / 60.0)::int),
    true,
    p_playlist_url,
    v_seconds
  )
  returning id into v_active_id;

  select coalesce(quantity, 0) into v_qty
  from public.content_tickets
  where child_id = p_child_id;

  session_id := v_active_id;
  remaining_play_seconds := v_seconds;
  ticket_quantity := v_qty;
  watch_seconds_pool := 0;
  resumed := false;
  return next;
end;
$$;

comment on function public.begin_content_viewing(uuid, text) is
  '남은 시청 시간 풀에서 세션을 시작하거나, 진행 중 세션을 재개합니다.';

grant execute on function public.begin_content_viewing(uuid, text) to authenticated;

-- ── 남은 재생 시간 저장 (뒤로가기) ───────────────────────────
create or replace function public.save_content_session_progress(
  p_session_id uuid,
  p_child_id uuid,
  p_remaining_play_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_remaining_play_seconds is null or p_remaining_play_seconds < 0 then
    raise exception 'invalid remaining';
  end if;

  if auth.uid() is distinct from p_child_id
     and not exists (
       select 1 from public.family_links fl
       where fl.parent_id = auth.uid() and fl.child_id = p_child_id
     ) then
    raise exception 'forbidden';
  end if;

  update public.content_sessions
  set remaining_play_seconds = p_remaining_play_seconds,
      duration_minutes = greatest(1, ceil(p_remaining_play_seconds / 60.0)::int)
  where id = p_session_id
    and child_id = p_child_id
    and is_active = true;

  return found;
end;
$$;

grant execute on function public.save_content_session_progress(uuid, uuid, int) to authenticated;
