-- 체크리스트는 일정에 종속되지 않고 날짜별로 독립 관리한다.
CREATE TABLE IF NOT EXISTS public.calendar_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_link_id uuid NOT NULL REFERENCES public.family_links(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  checklist_date date NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) > 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_checklists_family_date
  ON public.calendar_checklists(family_link_id, checklist_date, sort_order, created_at);

ALTER TABLE public.calendar_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parent_manage_calendar_checklists" ON public.calendar_checklists;
CREATE POLICY "parent_manage_calendar_checklists"
  ON public.calendar_checklists FOR ALL
  USING (EXISTS (SELECT 1 FROM public.family_links fl WHERE fl.id = calendar_checklists.family_link_id AND fl.parent_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.family_links fl WHERE fl.id = calendar_checklists.family_link_id AND fl.parent_id = auth.uid()));

-- 기존 일정 연결 체크리스트는 해당 일정 시작일의 독립 체크리스트로 한 번만 옮긴다.
INSERT INTO public.calendar_checklists (family_link_id, child_id, checklist_date, title, sort_order, is_completed, completed_at, created_at)
SELECT ce.family_link_id, old.child_id, ce.start_date, old.title, old.sort_order, old.is_completed, old.completed_at, old.created_at
FROM public.calendar_event_checklists old
JOIN public.calendar_events ce ON ce.id = old.calendar_event_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.calendar_checklists current
  WHERE current.family_link_id = ce.family_link_id
    AND current.checklist_date = ce.start_date
    AND current.title = old.title
    AND current.created_at = old.created_at
);

NOTIFY pgrst, 'reload schema';
