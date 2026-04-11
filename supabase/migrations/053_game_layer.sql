-- ================================================================
-- 게임 레이어: 트리거, 아이템 잠금 해제, 배 위치 컬럼 추가
-- ================================================================

-- 1. 트리거 발동 이력 (idempotency gate)
--    PRIMARY KEY (child_id, trigger_key) 로 ON CONFLICT DO NOTHING 사용
CREATE TABLE IF NOT EXISTS child_trigger_fired (
  child_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trigger_key text        NOT NULL,
  fired_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, trigger_key)
);

-- 2. 캐릭터 아이템 잠금 해제 이력
CREATE TABLE IF NOT EXISTS child_item_unlocks (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_index  int         NOT NULL,
  trigger_key text        NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, item_index)
);

-- 3. child_stats 에 배 위치 + 하루 1회 하트 게이트 컬럼 추가
ALTER TABLE child_stats
  ADD COLUMN IF NOT EXISTS boat_section          int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boat_step             int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_hearts_full_date text;  -- YYYY-MM-DD

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------

-- child_trigger_fired: 자녀 본인 SELECT, 서비스 롤 INSERT
ALTER TABLE child_trigger_fired ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'child_trigger_fired' AND policyname = 'child_trigger_fired_child_select'
  ) THEN
    CREATE POLICY child_trigger_fired_child_select
      ON child_trigger_fired FOR SELECT
      USING (auth.uid() = child_id);
  END IF;
END;
$$;

-- 부모가 자녀 트리거 이력 조회 (family_links 경유)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'child_trigger_fired' AND policyname = 'child_trigger_fired_parent_select'
  ) THEN
    CREATE POLICY child_trigger_fired_parent_select
      ON child_trigger_fired FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM family_links
          WHERE family_links.child_id  = child_trigger_fired.child_id
            AND family_links.parent_id = auth.uid()
        )
      );
  END IF;
END;
$$;

-- child_item_unlocks: 자녀 본인 SELECT
ALTER TABLE child_item_unlocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'child_item_unlocks' AND policyname = 'child_item_unlocks_child_select'
  ) THEN
    CREATE POLICY child_item_unlocks_child_select
      ON child_item_unlocks FOR SELECT
      USING (auth.uid() = child_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'child_item_unlocks' AND policyname = 'child_item_unlocks_parent_select'
  ) THEN
    CREATE POLICY child_item_unlocks_parent_select
      ON child_item_unlocks FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM family_links
          WHERE family_links.child_id  = child_item_unlocks.child_id
            AND family_links.parent_id = auth.uid()
        )
      );
  END IF;
END;
$$;

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE child_item_unlocks;
