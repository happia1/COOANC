-- 현재 미션 분류와 public/assets/img/missions/routine 폴더를 일치시킵니다.
-- 과거 표기는 먼저 현재 칩의 표준 제목 하나로 바꾼 뒤, 표준 제목에만 아이콘을 지정합니다.

BEGIN;

UPDATE public.missions
SET title = CASE btrim(title)
  WHEN '이불 정리하기' THEN '이불정리하기'
  WHEN '이불개기' THEN '이불정리하기'
  WHEN '이불 개기' THEN '이불정리하기'
  WHEN '머리 빗기' THEN '머리빗기'
  WHEN '로션바르기' THEN '로션(선크림)바르기'
  WHEN '로션 바르기' THEN '로션(선크림)바르기'
  WHEN '숙제하기' THEN '숙제·공부하기'
  WHEN '빨래통에 옷넣기' THEN '빨래통에넣기'
  WHEN '빨래통에 넣기' THEN '빨래통에넣기'
  WHEN '빨래 정리' THEN '빨래정리'
  ELSE btrim(title)
END
WHERE btrim(title) IN (
  '이불 정리하기', '이불개기', '이불 개기',
  '머리 빗기',
  '로션바르기', '로션 바르기',
  '숙제하기',
  '빨래통에 옷넣기', '빨래통에 넣기',
  '빨래 정리'
);

UPDATE public.missions
SET icon_emoji = '/assets/img/missions/routine/a.m/clean_bed.png'
WHERE title = '이불정리하기';

UPDATE public.missions
SET icon_emoji = '/assets/img/missions/routine/a.m/comb_hair.png'
WHERE title = '머리빗기';

UPDATE public.missions
SET icon_emoji = '/assets/img/missions/routine/a.m/gargle.png'
WHERE title = '가글하기';

UPDATE public.missions
SET icon_emoji = '/assets/img/missions/routine/a.m/lotion.png'
WHERE title = '로션(선크림)바르기';

UPDATE public.missions
SET icon_emoji = '/assets/img/missions/routine/p.m/brush_teeth.png'
WHERE title = '잠자리 양치';

UPDATE public.missions
SET icon_emoji = CASE
  WHEN difficulty = 'special'
    THEN '/assets/img/missions/routine/special/diary_homework.png'
  ELSE '/assets/img/missions/routine/p.m/diary_homework.png'
END
WHERE title = '숙제·공부하기';

UPDATE public.missions
SET icon_emoji = '/assets/img/missions/routine/special/roundrybasket.png'
WHERE title = '빨래통에넣기';

UPDATE public.missions
SET icon_emoji = '/assets/img/missions/routine/special/organize_cloth.png'
WHERE title = '빨래정리';

COMMIT;

NOTIFY pgrst, 'reload schema';
