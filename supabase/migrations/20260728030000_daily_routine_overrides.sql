-- 실제 아이 앱 루틴은 일정별 값이 아니라 자녀·날짜별 단 하나의 선택값으로 결정한다.
CREATE TABLE IF NOT EXISTS public.daily_routine_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_link_id uuid NOT NULL REFERENCES public.family_links(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  routine_date date NOT NULL,
  routine_type text NOT NULL CHECK (routine_type IN ('weekday', 'weekend', 'holiday')),
  source_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, routine_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_routine_overrides_child_date ON public.daily_routine_overrides(child_id, routine_date);
ALTER TABLE public.daily_routine_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parent_manage_daily_routine_overrides" ON public.daily_routine_overrides;
CREATE POLICY "parent_manage_daily_routine_overrides" ON public.daily_routine_overrides FOR ALL
USING (EXISTS (SELECT 1 FROM public.family_links fl WHERE fl.id = daily_routine_overrides.family_link_id AND fl.parent_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.family_links fl WHERE fl.id = daily_routine_overrides.family_link_id AND fl.parent_id = auth.uid()));
NOTIFY pgrst, 'reload schema';
