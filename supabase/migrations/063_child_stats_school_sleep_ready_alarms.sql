-- 등원·잘 준비 알람 — 시각 + 사용 여부 + 주중/주말 (062 에 sleep_ready_time 이 있음)
alter table public.child_stats add column if not exists school_time text;
alter table public.child_stats add column if not exists school_time_enabled boolean not null default false;
alter table public.child_stats add column if not exists school_time_weekday boolean not null default true;
alter table public.child_stats add column if not exists school_time_weekend boolean not null default true;

alter table public.child_stats add column if not exists sleep_ready_time_enabled boolean not null default true;
alter table public.child_stats add column if not exists sleep_ready_time_weekday boolean not null default true;
alter table public.child_stats add column if not exists sleep_ready_time_weekend boolean not null default true;

comment on column public.child_stats.school_time is '등원 알림 HH:MM';
comment on column public.child_stats.school_time_enabled is '등원 알림 사용 여부';
comment on column public.child_stats.sleep_ready_time_enabled is '잘 준비 알림 사용 여부';
