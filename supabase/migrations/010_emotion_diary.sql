-- ============================================================
-- 010_emotion_diary.sql
-- 감정 그림일기 (자녀 1일 1건)
-- 부모-자녀 연결: public.family_links (parent_id, child_id)
-- ※ parent_child_relations 테이블은 이 프로젝트에 없습니다.
-- ============================================================

create table if not exists public.emotion_diary (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.profiles (id) on delete cascade,
  diary_date  date not null,
  face_id     text not null,
  shape_id    text,
  color_hex   text not null default '#E5E7EB',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (child_id, diary_date)
);

create index if not exists idx_emotion_diary_child_date
  on public.emotion_diary (child_id, diary_date desc);

alter table public.emotion_diary enable row level security;

drop policy if exists "child_select_own_emotion_diary" on public.emotion_diary;
drop policy if exists "child_insert_own_emotion_diary" on public.emotion_diary;
drop policy if exists "child_update_own_emotion_diary" on public.emotion_diary;
drop policy if exists "parent_read_child_diary" on public.emotion_diary;

-- 자녀: 본인 일기 조회
create policy "child_select_own_emotion_diary"
  on public.emotion_diary for select
  using (auth.uid() = child_id);

-- 자녀: 본인 일기 작성
create policy "child_insert_own_emotion_diary"
  on public.emotion_diary for insert
  with check (auth.uid() = child_id);

-- 자녀: 본인 일기 수정
create policy "child_update_own_emotion_diary"
  on public.emotion_diary for update
  using (auth.uid() = child_id)
  with check (auth.uid() = child_id);

-- 부모: family_links 로 연결된 자녀 일기만 조회
create policy "parent_read_child_diary"
  on public.emotion_diary for select
  using (
    exists (
      select 1
      from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = emotion_diary.child_id
    )
  );

notify pgrst, 'reload schema';
