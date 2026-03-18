-- ─────────────────────────────────────────────────────────────
-- Zeitwerk – Supabase schema
-- Run this once in: Supabase dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────

-- Projects (shared across the whole team)
create table if not exists projects (
  id          text primary key,
  name        text not null,
  client      text not null default '',
  color       text not null default '#3b82f6',
  created_at  timestamptz not null default now()
);

-- Time entries (one row per stopped timer)
create table if not exists entries (
  id          text primary key,
  user_id     text not null,
  user_name   text not null,
  user_color  text not null default '#f59e0b',
  description text not null default 'No description',
  project_id  text references projects(id) on delete set null,
  start_time  bigint not null,
  end_time    bigint not null,
  duration    integer not null,
  created_at  timestamptz not null default now()
);

-- Active timers (one row per user, upserted while timer runs, deleted on stop)
create table if not exists active_timers (
  user_id     text primary key,
  user_name   text not null,
  user_color  text not null default '#f59e0b',
  description text not null default '',
  project_id  text references projects(id) on delete set null,
  start_time  bigint not null,
  updated_at  timestamptz not null default now()
);

-- ── Indexes for common queries
create index if not exists entries_user_id_idx    on entries(user_id);
create index if not exists entries_start_time_idx on entries(start_time);
create index if not exists entries_project_id_idx on entries(project_id);

-- ── Enable Row Level Security (RLS)
-- We use a simple "anyone with the URL can read/write" policy.
-- This is fine for a trusted internal team.
-- Upgrade to auth-based policies when you need stricter access control.
alter table projects      enable row level security;
alter table entries       enable row level security;
alter table active_timers enable row level security;

-- Allow all operations for all users (public team tool)
create policy "public access" on projects      for all using (true) with check (true);
create policy "public access" on entries       for all using (true) with check (true);
create policy "public access" on active_timers for all using (true) with check (true);

-- ── Seed default projects (optional – delete if you don't want them)
insert into projects (id, name, client, color) values
  ('p1', 'SAP Implementation', 'Client A', '#3b82f6'),
  ('p2', 'Internal',           '',          '#10b981'),
  ('p3', 'Admin & Planning',   '',          '#f59e0b')
on conflict (id) do nothing;
