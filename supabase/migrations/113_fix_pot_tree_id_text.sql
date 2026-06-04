-- ============================================================
-- 113_fix_pot_tree_id_text.sql
-- pot_tree_id 가 integer 로 남아 있으면 'strawberry' 저장 시 오류 발생
-- (invalid input syntax for type integer: "strawberry")
-- ============================================================

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'child_stats'
      and column_name = 'pot_tree_id'
      and data_type <> 'text'
  ) then
    alter table public.child_stats alter column pot_tree_id drop default;
    alter table public.child_stats
      alter column pot_tree_id type text
      using (
        case
          when pot_tree_id::text ~ '^[0-9]+$' then 'apple'
          else coalesce(nullif(trim(pot_tree_id::text), ''), 'apple')
        end
      );
    alter table public.child_stats alter column pot_tree_id set default 'apple';
    alter table public.child_stats alter column pot_tree_id set not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plant_seed_purchases'
      and column_name = 'tree_id'
      and data_type <> 'text'
  ) then
    alter table public.plant_seed_purchases
      alter column tree_id type text
      using (
        case
          when tree_id::text ~ '^[0-9]+$' then 'apple'
          else coalesce(nullif(trim(tree_id::text), ''), 'apple')
        end
      );
  end if;
end $$;
