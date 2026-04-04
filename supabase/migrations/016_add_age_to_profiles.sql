-- ============================================================
-- 016_add_age_to_profiles.sql
-- profiles 테이블에 age 컬럼 추가 (자녀 연령 기반 적응형 UI용)
-- ============================================================

alter table profiles add column if not exists age int check (age >= 1 and age <= 18);
