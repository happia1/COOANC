-- ============================================================
-- 012_curriculum_chunks.sql
-- RAG 커리큘럼 지식베이스 테이블 + 벡터 검색 함수
-- (Phase 2 AI 에이전트 전용 — service_role만 접근 가능)
-- NOTE: 001_extensions.sql 에서 vector 확장이 먼저 활성화되어야 함
-- ============================================================

create table if not exists curriculum_chunks (
  id          uuid primary key default uuid_generate_v4(),
  chunk_id    text unique not null,   -- 예: 'LEVEL-000', 'MISSION-001', 'EQ-SYSTEM'
  chunk_type  text not null,          -- 'level_definition' | 'mission_pool' | 'coaching_message' | 'eq_measurement' | 'agent_behavior' | 'gamification'
  content     text not null,          -- 청크 전체 텍스트 (임베딩 원본)
  embedding   vector(1536),           -- OpenAI text-embedding-3-small 벡터
  tags        text[] default '{}',
  metadata    jsonb default '{}',     -- {"level": 0, ...} 등 필터용 메타데이터
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- IVFFlat 인덱스 (코사인 유사도 검색)
create index if not exists curriculum_chunks_embedding_idx
  on curriculum_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================
-- 벡터 유사도 검색 함수
-- 사용 예: select * from search_curriculum('{...}'::vector, 0.7, 5, 'level_definition', 0)
-- ============================================================
create or replace function search_curriculum(
  query_embedding  vector(1536),
  match_threshold  float   default 0.7,
  match_count      int     default 5,
  filter_type      text    default null,   -- chunk_type 필터 (null = 전체)
  filter_level     int     default null    -- metadata.level 필터 (null = 전체)
)
returns table (
  chunk_id    text,
  chunk_type  text,
  content     text,
  tags        text[],
  similarity  float
)
language plpgsql as $$
begin
  return query
  select
    cc.chunk_id,
    cc.chunk_type,
    cc.content,
    cc.tags,
    1 - (cc.embedding <=> query_embedding) as similarity
  from curriculum_chunks cc
  where
    (filter_type  is null or cc.chunk_type = filter_type)
    and (filter_level is null or (cc.metadata->>'level')::int = filter_level)
    and 1 - (cc.embedding <=> query_embedding) > match_threshold
  order by cc.embedding <=> query_embedding
  limit match_count;
end;
$$;
