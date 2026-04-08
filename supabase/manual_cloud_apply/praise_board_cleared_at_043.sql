-- 수동 적용용(클라우드 대시보드 등): 043_praise_board_cleared_at.sql 과 동일
alter table public.child_stats
  add column if not exists praise_board_cleared_at timestamptz;

comment on column public.child_stats.praise_board_cleared_at is
  '스티커 판 전체 초기화(reset-board) 시각. 이보다 이전에 지급된 칭찬 스티커는 새 판 종이 위 목록에서 숨김';
