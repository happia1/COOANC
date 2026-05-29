-- ============================================================
-- 092_notices_cms_popup_columns.sql
-- 공지(notices) 테이블을 "운영형 CMS" 구조로 확장합니다. (STEP 1 + STEP 9)
--
-- 비개발자 요약:
-- - 공지를 종류별(공지/가이드/이벤트/업데이트/안내)로 나눠 보여줄 수 있게 합니다.
-- - "앱 실행 시 뜨는 팝업" 공지를 운영할 수 있게 컬럼을 추가합니다.
-- - 기존 공지 데이터는 그대로 두고, 비어 있는 새 칸만 채웁니다.
-- - 공지는 삭제하지 않고 is_active=false 로 끄고, 노출 기간은 start_at/end_at,
--   팝업 노출 기간은 popup_until 로 관리합니다.
--
-- 이 파일은 "여러 번 실행해도 안전(idempotent)"하도록 작성했습니다.
-- (대시보드에서 notices 테이블을 직접 만든 환경과, 아직 테이블이 없는 새 환경 모두 대응)
-- ============================================================

-- 0) 테이블이 아예 없는 새 환경을 위해, 전체 스키마로 한 번 만들어 둡니다.
--    이미 있으면(운영/기존 환경) 이 블록은 건너뜁니다.
create table if not exists public.notices (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null default '',
  link_url    text,
  link_label  text,
  order_index int not null default 0,
  is_active   boolean not null default true,
  start_at    timestamptz,
  end_at      timestamptz,
  notice_type text default 'notice',
  popup_type  text default 'none',
  popup_until timestamptz,
  created_at  timestamptz not null default now()
);

-- 1) 기존 환경(이미 테이블이 있는 경우)을 위해 빠진 칸을 하나씩 보강합니다.
--    "if not exists" 라서 이미 있는 칸은 그대로 둡니다.
alter table public.notices add column if not exists title       text;
alter table public.notices add column if not exists body        text default '';
alter table public.notices add column if not exists link_url    text;
alter table public.notices add column if not exists link_label  text;
alter table public.notices add column if not exists order_index int default 0;
alter table public.notices add column if not exists is_active   boolean default true;
alter table public.notices add column if not exists start_at    timestamptz;
alter table public.notices add column if not exists end_at      timestamptz;
alter table public.notices add column if not exists created_at  timestamptz default now();

-- 운영형 CMS 신규 칸 (STEP 1 핵심)
--  - notice_type: 공지 종류 (기본 'notice')
--  - popup_type : 팝업 노출 방식 (기본 'none' = 팝업 없음)
--  - popup_until: 팝업 노출 마감 시각 (null 이면 기간 제한 없음)
alter table public.notices add column if not exists notice_type text default 'notice';
alter table public.notices add column if not exists popup_type  text default 'none';
alter table public.notices add column if not exists popup_until timestamptz;

-- 2) 기본값 보정: 새로 추가된 칸이 비어 있는(NULL) 기존 행을 기본값으로 채웁니다.
--    (nullable 은 유지하되, 비어 있으면 운영 기본값으로 동작하도록 함)
update public.notices set notice_type = 'notice' where notice_type is null;
update public.notices set popup_type  = 'none'   where popup_type  is null;

-- 3) 허용 값 제약(CHECK): 오타로 엉뚱한 값이 들어가는 것을 막습니다.
--    NULL 은 통과시키므로 nullable 정책과 충돌하지 않습니다.
--    (다시 실행해도 되도록 기존 제약을 지우고 새로 겁니다.)
alter table public.notices drop constraint if exists notices_notice_type_check;
alter table public.notices
  add constraint notices_notice_type_check
  check (notice_type is null or notice_type in ('notice', 'guide', 'event', 'update', 'info'));

alter table public.notices drop constraint if exists notices_popup_type_check;
alter table public.notices
  add constraint notices_popup_type_check
  check (popup_type is null or popup_type in ('none', 'once', 'important', 'force'));

-- 4) 조회 성능용 인덱스 — 활성 공지를 order_index/created_at 순으로 자주 읽습니다. (STEP 2)
create index if not exists notices_active_order_idx
  on public.notices (is_active, order_index, created_at desc);

-- 5) 보안(RLS): 로그인한 사용자는 "활성 공지"를 읽을 수 있게 합니다.
--    (다시 실행해도 되도록 같은 이름의 정책을 지우고 새로 만듭니다.)
alter table public.notices enable row level security;

drop policy if exists "notices_select_active_authenticated" on public.notices;
create policy "notices_select_active_authenticated"
  on public.notices
  for select
  to authenticated
  using (is_active = true);

grant select on public.notices to authenticated;

-- 6) 문서화용 코멘트
comment on column public.notices.notice_type is
  '공지 종류: notice(공지사항)/guide(사용 가이드)/event(이벤트)/update(업데이트)/info(안내사항)';
comment on column public.notices.popup_type is
  '앱 실행 팝업 방식: none(없음)/once(1회)/important(강조)/force(확인 전 닫기 불가)';
comment on column public.notices.popup_until is
  '팝업 노출 마감 시각. null 이면 기간 제한 없이 유지. 지나면 팝업만 꺼지고 공지센터에는 계속 노출.';
comment on column public.notices.start_at is '공지 노출 시작 시각. null 이면 즉시 노출.';
comment on column public.notices.end_at is '공지 노출 종료 시각(이벤트 종료 등). null 이면 무기한.';
