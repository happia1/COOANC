-- 자녀 앱 「잘 준비」 팝업 시각 — 부모 루틴 알람 시트에서 설정
alter table public.child_stats
  add column if not exists sleep_ready_time text;

comment on column public.child_stats.sleep_ready_time is
  'HH:MM — 이 시각에 자녀 화면에 잘 준비 알림(로컬 시계 기준, 서울/기기 타임존)';
