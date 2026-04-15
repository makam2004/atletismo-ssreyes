create table if not exists public.athlete_results (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  athlete_name text not null,
  category text,
  club_name text,
  event_name text not null,
  mark_raw text not null,
  mark_seconds double precision,
  position_raw text,
  athlete_license text,
  source_file_name text not null
);

create index if not exists idx_athlete_results_event_name on public.athlete_results (event_name);
create index if not exists idx_athlete_results_category on public.athlete_results (category);
create index if not exists idx_athlete_results_club_name on public.athlete_results (club_name);
create index if not exists idx_athlete_results_mark_seconds on public.athlete_results (mark_seconds);
