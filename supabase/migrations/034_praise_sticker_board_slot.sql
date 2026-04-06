-- 곰돌이 판 1~20번 슬롯에 스티커를 붙일 때 사용(신규 UI). 기존 행은 board_slot NULL 로 자유 좌표 유지.

alter table public.praise_sticker_placements
  add column if not exists board_slot smallint null;

alter table public.praise_sticker_placements
  drop constraint if exists praise_sticker_placements_board_slot_range;

alter table public.praise_sticker_placements
  add constraint praise_sticker_placements_board_slot_range
  check (board_slot is null or (board_slot >= 1 and board_slot <= 20));

drop index if exists public.praise_sticker_placements_child_slot_uidx;

create unique index praise_sticker_placements_child_slot_uidx
  on public.praise_sticker_placements (child_id, board_slot)
  where board_slot is not null;
