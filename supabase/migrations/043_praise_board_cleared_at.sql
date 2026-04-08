-- 곰돌이 스티커 판이 20칸 꽉 찬 뒤 reset-board 로 비울 때의 시각
-- sessionStorage 만 쓰면 새 탭·다른 기기에서 예전에 받은 스티커가 종이 위에 다시 쌓입니다.
alter table public.child_stats
  add column if not exists praise_board_cleared_at timestamptz;

comment on column public.child_stats.praise_board_cleared_at is
  '스티커 판 전체 초기화(reset-board) 시각. 이보다 이전에 지급된 칭찬 스티커는 새 판 종이 위 목록에서 숨김';
