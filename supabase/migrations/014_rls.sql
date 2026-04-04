-- ============================================================
-- 014_rls.sql
-- 전체 테이블 Row Level Security 정책
-- curriculum_chunks: service_role 전용 (anon/authenticated 차단)
-- ============================================================

-- RLS 활성화
alter table profiles           enable row level security;
alter table family_links       enable row level security;
alter table child_stats        enable row level security;
alter table missions           enable row level security;
alter table mission_logs       enable row level security;
alter table savings_goals      enable row level security;
alter table store_items        enable row level security;
alter table purchase_requests  enable row level security;
alter table badges             enable row level security;
alter table child_badges       enable row level security;
alter table curriculum_chunks  enable row level security;

-- ============================================================
-- profiles: 본인만 읽기/수정
-- ============================================================
create policy "profiles_self"
  on profiles for all
  using (auth.uid() = id);

-- ============================================================
-- family_links: 부모 또는 자녀 본인만 접근
-- ============================================================
create policy "family_links_member"
  on family_links for all
  using (auth.uid() = parent_id or auth.uid() = child_id);

-- ============================================================
-- child_stats: 본인(자녀) 또는 연결된 부모 접근
-- ============================================================
create policy "child_stats_access"
  on child_stats for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from family_links
      where parent_id = auth.uid() and child_id = child_stats.child_id
    )
  );

-- ============================================================
-- missions: 전체 인증 사용자 읽기 (미션 풀은 공개)
--           생성/수정/삭제는 service_role로만 (관리자 운영)
-- ============================================================
create policy "missions_read"
  on missions for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- mission_logs: 본인(자녀) 또는 연결된 부모 접근
-- ============================================================
create policy "mission_logs_access"
  on mission_logs for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from family_links
      where parent_id = auth.uid() and child_id = mission_logs.child_id
    )
  );

-- ============================================================
-- savings_goals: 본인(자녀) 또는 연결된 부모 접근
-- ============================================================
create policy "savings_goals_access"
  on savings_goals for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from family_links
      where parent_id = auth.uid() and child_id = savings_goals.child_id
    )
  );

-- ============================================================
-- store_items: 인증 사용자 읽기 / 관리자만 생성·수정
-- ============================================================
create policy "store_items_read"
  on store_items for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- purchase_requests: 본인(자녀) 또는 연결된 부모 접근
-- ============================================================
create policy "purchase_requests_access"
  on purchase_requests for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from family_links
      where parent_id = auth.uid() and child_id = purchase_requests.child_id
    )
  );

-- ============================================================
-- badges: 인증 사용자 읽기 전용
-- ============================================================
create policy "badges_read"
  on badges for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- child_badges: 본인(자녀) 또는 연결된 부모 접근
-- ============================================================
create policy "child_badges_access"
  on child_badges for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from family_links
      where parent_id = auth.uid() and child_id = child_badges.child_id
    )
  );

-- ============================================================
-- curriculum_chunks: service_role 전용 (보안 핵심)
-- anon/authenticated 키로 접근 시 RLS 차단
-- ============================================================
create policy "curriculum_service_only"
  on curriculum_chunks for all
  using (auth.role() = 'service_role');
