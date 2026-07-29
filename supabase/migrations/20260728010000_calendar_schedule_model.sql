-- fridge 방식의 일정 입력을 쿠앤크에 적용하기 위한 확장 모델.
-- event_type은 표시·분류용이며, 루틴 변경은 routine_override만으로 결정한다.

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS category_main text,
  ADD COLUMN IF NOT EXISTS category_sub text,
  ADD COLUMN IF NOT EXISTS is_all_day boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS time_start time,
  ADD COLUMN IF NOT EXISTS time_end time,
  ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS place text,
  ADD COLUMN IF NOT EXISTS notify_offset text,
  ADD COLUMN IF NOT EXISTS notify_custom_at timestamptz,
  ADD COLUMN IF NOT EXISTS recur_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recur_until date;

-- 기존 표시 종류(event_type)를 fridge식 일정 분류로 한 번 옮깁니다.
-- 이미 부모가 새 분류를 골라 저장한 행은 보존합니다.
UPDATE public.calendar_events
SET
  category_main = CASE event_type
    WHEN 'holiday' THEN '공휴일'
    WHEN 'travel' THEN '여행'
    WHEN 'birthday' THEN '행사'
    WHEN 'vacation' THEN '교육'
    WHEN 'school' THEN '교육'
    WHEN 'special' THEN '행사'
    WHEN 'event' THEN '행사'
    ELSE '기타'
  END,
  category_sub = CASE event_type
    WHEN 'birthday' THEN '생일'
    WHEN 'vacation' THEN '방학'
    WHEN 'special' THEN '기념일'
    WHEN 'event' THEN '기념일'
    ELSE NULL
  END
WHERE category_main IS NULL OR btrim(category_main) = '';

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_recur_type_check;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_recur_type_check
  CHECK (recur_type IN ('none', 'weekly', 'monthly', 'yearly'));

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_time_range_check;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_time_range_check
  CHECK (time_end IS NULL OR time_start IS NULL OR time_end >= time_start);

CREATE TABLE IF NOT EXISTS public.calendar_event_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) > 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_checklists_event_order
  ON public.calendar_event_checklists(calendar_event_id, sort_order, created_at);

ALTER TABLE public.calendar_event_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parent_manage_calendar_event_checklists" ON public.calendar_event_checklists;
CREATE POLICY "parent_manage_calendar_event_checklists"
  ON public.calendar_event_checklists FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.calendar_events ce
      JOIN public.family_links fl ON fl.id = ce.family_link_id
      WHERE ce.id = calendar_event_checklists.calendar_event_id
        AND fl.parent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.calendar_events ce
      JOIN public.family_links fl ON fl.id = ce.family_link_id
      WHERE ce.id = calendar_event_checklists.calendar_event_id
        AND fl.parent_id = auth.uid()
    )
  );

COMMENT ON COLUMN public.calendar_events.event_type IS
  '과거 일정 호환 및 색상 파생용 내부 값. 부모 입력은 category_main/category_sub만 사용하며, 루틴은 routine_override를 직접 선택한다.';

NOTIFY pgrst, 'reload schema';
