revoke all on function public.complete_mission_reward(uuid,integer,integer,integer,date,boolean) from public,anon,authenticated;
grant execute on function public.complete_mission_reward(uuid,integer,integer,integer,date,boolean) to service_role;
-- Keep ordinary settings writable, but protected stats require a verified server operation.
revoke insert,update,delete,truncate,references,trigger on public.child_stats from anon,authenticated;
do $$ declare cols text; begin
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns
  where table_schema='public' and table_name='child_stats' and column_name not like 'piggy_%' and column_name not in
    ('id','child_id','credits','credits_wallet','credits_piggy','hearts','exp','current_level','exp_to_next_level',
     'total_credits_earned','streak_days','longest_streak','last_mission_date','boat_section','boat_step',
     'last_hearts_full_date','pot_stage','pot_hearts_used','pot_completed','pot_tree_id',
     'eq_routine_rate','eq_save_ratio','eq_delay_score','created_at','promotion_pending','promotion_eligible_at','sleep_session_locked_date');
  execute 'grant update ('||cols||') on public.child_stats to authenticated';
end $$;
revoke insert,update,delete,truncate,references,trigger on public.mission_logs from anon,authenticated;
revoke update,delete,truncate,references,trigger on public.daily_missions from anon,authenticated;
drop policy if exists parent_insert_child_daily_missions on public.daily_missions;
create policy parent_insert_child_daily_missions on public.daily_missions for insert to authenticated with check (
  not is_completed and completion_version=0 and exists(select 1 from public.family_links fl where fl.parent_id=(select auth.uid()) and fl.child_id=daily_missions.child_id)
  and exists(select 1 from public.missions m where m.id=mission_template_id and m.linked_child_id=daily_missions.child_id)
);
drop policy if exists child_insert_own_daily_missions on public.daily_missions;
create policy child_insert_own_daily_missions on public.daily_missions for insert to authenticated with check (
  (select auth.uid())=child_id and not is_completed and completion_version=0
  and exists(select 1 from public.missions m where m.id=mission_template_id and m.linked_child_id=daily_missions.child_id)
);

revoke all on function public.claim_piggy_bonus(uuid,integer) from public,anon,authenticated;
revoke all on function public.settle_piggy_bonus(uuid) from public,anon,authenticated;
revoke all on function public.recalculate_eq(uuid) from public,anon,authenticated;
grant execute on function public.claim_piggy_bonus(uuid,integer), public.settle_piggy_bonus(uuid), public.recalculate_eq(uuid) to service_role;
