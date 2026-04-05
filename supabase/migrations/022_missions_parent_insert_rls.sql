-- ============================================================
-- 부모가 온보딩·루틴 설정에서 /api/mission/create 로 미션 템플릿을
-- missions 테이블에 넣을 수 있도록 INSERT 정책 추가
-- (기존 014_rls: missions 는 select 만 허용 → insert 시 RLS 거부로 500 발생)
-- ============================================================

create policy "missions_parent_insert"
  on public.missions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'parent'
    )
  );
