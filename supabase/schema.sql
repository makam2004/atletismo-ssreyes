create table if not exists public.athlete_marks (
  id bigint generated always as identity primary key,
  source_file_id text not null,
  source_file_name text not null,
  source_modified_time timestamptz null,
  source_sheet_name text not null,
  row_number integer not null,
  athlete_name text not null,
  category text null,
  club_name text null,
  license text null,
  event_name text null,
  mark_raw text not null,
  mark_value_seconds double precision null,
  position text null,
  row_hash text not null unique,
  inserted_at timestamptz not null default now()
);

create index if not exists athlete_marks_category_idx on public.athlete_marks (category);
create index if not exists athlete_marks_name_idx on public.athlete_marks (athlete_name);
create index if not exists athlete_marks_club_idx on public.athlete_marks (club_name);
create index if not exists athlete_marks_event_idx on public.athlete_marks (event_name);
create index if not exists athlete_marks_file_idx on public.athlete_marks (source_file_id);
