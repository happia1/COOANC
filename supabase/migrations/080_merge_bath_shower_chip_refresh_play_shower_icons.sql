-- ============================================================
-- 080_merge_bath_shower_chip_refresh_play_shower_icons.sql
-- 1) 「목욕/샤워」칩 제거에 맞춰 데이터 정리 — 중복이면 삭제, 아니면 「샤워하기」로 통합
-- 2) 「샤워하기」icon_emoji 를 p.m/shower.png 로 통일
-- 3) 야외·실내 놀이 아이콘 재적용(079 와 동일·멱등)
-- ============================================================

begin;

delete from public.missions m1
where btrim(replace(m1.title, '／', '/')) = '목욕/샤워'
  and m1.linked_child_id is not null
  and exists (
    select 1
    from public.missions m2
    where m2.linked_child_id = m1.linked_child_id
      and btrim(m2.title) = '샤워하기'
      and m2.id <> m1.id
  );

update public.missions
set
  title = '샤워하기',
  icon_emoji = '/assets/img/missions/routine/p.m/shower.png'
where btrim(replace(title, '／', '/')) = '목욕/샤워';

update public.missions
set icon_emoji = '/assets/img/missions/routine/p.m/shower.png'
where btrim(title) = '샤워하기'
  and icon_emoji is distinct from '/assets/img/missions/routine/p.m/shower.png';

update public.missions
set icon_emoji = '/assets/img/missions/routine/p.m/paly_outside.png'
where regexp_replace(btrim(title), '\s', '', 'g') in ('야외놀이', '실외놀이', '바깥놀이');

update public.missions
set icon_emoji = '/assets/img/missions/routine/p.m/play_inside.png'
where regexp_replace(btrim(title), '\s', '', 'g') = '실내놀이';

commit;

notify pgrst, 'reload schema';
