-- ============================================================
-- 066_dedupe_seu_seuhaegi_missions.sql
-- "세수" / 이중 "세수하기" 루틴 템플릿 정리 — daily_missions 는 missions 삭제 시 CASCADE
-- ============================================================

-- 1) 구 제목 "세수" 템플릿 제거(세수하기로 이미 065에서 옮긴 뒤에도 id 가 남은 경우)
delete from public.missions
where trim(title) = '세수';

-- 2) 같은 자녀·같은 블록·같은 repeat_type 에 "세수하기" 가 두 개 이상 → id 가 큰 행 제거
delete from public.missions a
using public.missions b
where a.id > b.id
  and a.linked_child_id is not null
  and a.linked_child_id = b.linked_child_id
  and trim(a.title) = '세수하기'
  and trim(b.title) = '세수하기'
  and a.repeat_type = b.repeat_type
  and a.block is not distinct from b.block;
