-- docs/supabase-keepalive.sql
-- Run once in the Supabase dashboard (SQL Editor) for the catalogify project.
-- Creates a tiny table the app SELECTs on launch to keep the free-tier project
-- from pausing after 7 days of inactivity. Exposes no sensitive data.

create table if not exists public.keepalive (
  id int primary key,
  pinged_at timestamptz default now()
);

insert into public.keepalive (id) values (1) on conflict do nothing;

alter table public.keepalive enable row level security;

-- Readable by all roles (anon + authenticated) so the ping works signed-in or out.
create policy "keepalive readable" on public.keepalive
  for select using (true);
