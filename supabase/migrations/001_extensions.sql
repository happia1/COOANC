-- ============================================================
-- 001_extensions.sql
-- pgvector, uuid-ossp 확장 활성화
-- ============================================================

create extension if not exists vector;
create extension if not exists "uuid-ossp";
