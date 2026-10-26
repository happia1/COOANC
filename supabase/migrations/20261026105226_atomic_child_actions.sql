-- One child_stats lock order for completion, undo and watering. Receipts survive response loss.
alter table public.daily_missions add column if not exists completion_version integer not null default 0;
create table public.child_action_receipts (
  child_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  kind text not null check (kind in ('complete','undo','water')),
  target_id uuid,
  result jsonb not null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(child_id,request_id)
);
alter table public.child_action_receipts enable row level security;
revoke all on public.child_action_receipts from public, anon, authenticated;
grant all on public.child_action_receipts to service_role;

create or replace function public.apply_daily_mission_action(
  p_child_id uuid, p_daily_id uuid, p_request_id uuid, p_version integer,
  p_undo boolean default false, p_recent_only boolean default false
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  s child_stats%rowtype; d daily_missions%rowtype; m missions%rowtype; l mission_logs%rowtype;
  r child_action_receipts%rowtype; result jsonb; reward jsonb;
  mult integer; c integer; h integer; e integer; total integer; done integer;
begin
  select * into s from child_stats where child_id=p_child_id for update;
  if not found then raise exception 'STATS_NOT_FOUND'; end if;
  select * into r from child_action_receipts where child_id=p_child_id and request_id=p_request_id;
  if found then
    if r.target_id is distinct from p_daily_id or r.kind <> (case when p_undo then 'undo' else 'complete' end) then raise exception 'REQUEST_CONFLICT'; end if;
    return r.result || jsonb_build_object('replayed',true,'stats',to_jsonb(s));
  end if;
  select * into d from daily_missions where id=p_daily_id and child_id=p_child_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if p_version is null or d.completion_version<>p_version then raise exception 'STALE_COMPLETION'; end if;
  if p_undo then
    if s.sleep_session_locked_date::text = d.date::text then raise exception 'SLEEP_LOCKED'; end if;
    if p_recent_only and (d.completed_at is null or d.completed_at < now()-interval '5 minutes') then raise exception 'NOT_RECENT'; end if;
    if not d.is_completed then raise exception 'NOT_COMPLETED'; end if;
    select * into l from mission_logs where child_id=p_child_id and mission_id=d.mission_template_id and assigned_date=d.date for update;
    if not found or not l.is_completed then raise exception 'LOG_NOT_COMPLETED'; end if;
    update child_stats set credits=greatest(0,credits-l.credit_earned),
      hearts=greatest(0,hearts-l.heart_earned), exp=greatest(0,exp-l.exp_earned),
      total_credits_earned=greatest(0,total_credits_earned-l.credit_earned) where child_id=p_child_id;
    update daily_missions set is_completed=false,completed_at=null,completion_version=completion_version+1 where id=d.id;
    update mission_logs set is_completed=false,completed_at=null,credit_earned=0,heart_earned=0,exp_earned=0 where id=l.id;
    perform recalculate_eq(p_child_id);
    result:=jsonb_build_object('dailyMissionId',d.id,'completionVersion',d.completion_version+1);
  else
    if d.is_completed then
      -- Different tab/request for the same version must not pay twice.
      result:=jsonb_build_object('alreadyCompleted',true,'dailyMissionId',d.id,'completionVersion',d.completion_version);
    else
      select * into m from missions where id=d.mission_template_id;
      if not found then raise exception 'TEMPLATE_NOT_FOUND'; end if;
      mult:=case when m.reward_multiplier in (2,3) then m.reward_multiplier else 1 end;
      c:=m.credit_reward*mult; h:=m.heart_reward*mult; e:=m.exp_reward*mult;
      update daily_missions set is_completed=true,completed_at=now() where id=d.id;
      insert into mission_logs(child_id,mission_id,assigned_date,is_completed,completed_at,credit_earned,heart_earned,exp_earned)
        values(p_child_id,d.mission_template_id,d.date,true,now(),c,h,e)
        on conflict(child_id,mission_id,assigned_date) do update set is_completed=true,completed_at=excluded.completed_at,
          credit_earned=excluded.credit_earned,heart_earned=excluded.heart_earned,exp_earned=excluded.exp_earned;
      select count(*),count(*) filter(where is_completed) into total,done from daily_missions where child_id=p_child_id and date=d.date;
      reward:=complete_mission_reward(p_child_id,c,h,e,d.date,total>0 and done::numeric/total>=0.9);
      result:=jsonb_build_object('dailyMissionId',d.id,'completionVersion',d.completion_version,'reward',reward,
        'creditReward',c,'heartReward',h,'expReward',e,'rewardMultiplier',mult);
    end if;
  end if;
  select * into s from child_stats where child_id=p_child_id;
  result:=result || jsonb_build_object('stats',to_jsonb(s));
  insert into child_action_receipts(child_id,request_id,kind,target_id,result)
    values(p_child_id,p_request_id,case when p_undo then 'undo' else 'complete' end,d.id,result);
  return result;
end $$;
revoke all on function public.apply_daily_mission_action(uuid,uuid,uuid,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.apply_daily_mission_action(uuid,uuid,uuid,integer,boolean,boolean) to service_role;

create or replace function public.water_child_plant(p_child_id uuid,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  s child_stats%rowtype; r child_action_receipts%rowtype;
  stage integer; used integer; needed integer; tree text; grew boolean:=false;
  qty integer; harvest jsonb; result jsonb; has_seed boolean;
begin
  select * into s from child_stats where child_id=p_child_id for update;
  if not found then raise exception 'STATS_NOT_FOUND'; end if;
  select * into r from child_action_receipts where child_id=p_child_id and request_id=p_request_id;
  if found then
    if r.kind<>'water' then raise exception 'REQUEST_CONFLICT'; end if;
    return r.result || jsonb_build_object('replayed',true);
  end if;
  tree:=coalesce(s.pot_tree_id,'apple');
  if tree not in ('apple','strawberry','lemon','cherry','blueberry','sunflower') then tree:='apple'; end if;
  stage:=least(7,greatest(0,coalesce(s.pot_stage,0))); used:=greatest(0,coalesce(s.pot_hearts_used,0));
  if tree<>'apple' and stage=0 and (used>0 or s.pot_completed) then stage:=1; end if;
  -- Match normalizePlantPotProgress before applying one unit of water.
  while stage<7 and (tree='apple' or stage>0) loop
    needed:=(array[3,5,8,10,15,20,25])[stage+1];
    exit when used<needed;
    used:=used-needed; stage:=stage+1;
  end loop;
  has_seed:=tree<>'apple' or stage>0 or used>0 or exists(select 1 from plant_seed_purchases where child_id=p_child_id);
  if not has_seed or (tree<>'apple' and stage=0) then return jsonb_build_object('ok',false,'code','NO_SEED_CHOSEN'); end if;
  if stage>=7 then return jsonb_build_object('ok',false,'code','PLANT_COMPLETED'); end if;
  if s.hearts<=0 then return jsonb_build_object('ok',false,'code','NO_HEARTS'); end if;
  needed:=(array[3,5,8,10,15,20,25])[stage+1];
  used:=used+1;
  if used>=needed then stage:=stage+1; used:=0; grew:=true; end if;
  update child_stats set hearts=hearts-1,pot_stage=stage,pot_hearts_used=used,pot_completed=(stage=7)
    where child_id=p_child_id returning * into s;
  if grew and stage=7 then
    qty:=1+floor(random()*5)::integer;
    insert into plant_harvest_inventory(child_id,fruit_id,quantity) values(p_child_id,tree,qty)
      on conflict(child_id,fruit_id) do update set quantity=plant_harvest_inventory.quantity+excluded.quantity,updated_at=now();
    harvest:=jsonb_build_object('fruitId',tree,'amount',qty);
  end if;
  result:=jsonb_build_object('ok',true,'requestId',p_request_id,'grew',grew,'newStage',case when grew then stage end,
    'hearts',s.hearts,'pot_stage',stage,'pot_hearts_used',used,'pot_completed',stage=7,'harvest',harvest);
  insert into child_action_receipts(child_id,request_id,kind,result) values(p_child_id,p_request_id,'water',result);
  return result;
end $$;
revoke all on function public.water_child_plant(uuid,uuid) from public,anon,authenticated;
grant execute on function public.water_child_plant(uuid,uuid) to service_role;
