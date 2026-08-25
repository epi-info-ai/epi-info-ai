-- Epi Info AI demo project snapshots.
-- Run once in the Supabase SQL Editor before using Project Storage.

create table if not exists public.epi_projects (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  snapshot jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists epi_projects_owner_updated_idx
  on public.epi_projects (owner_id, updated_at desc);

alter table public.epi_projects enable row level security;

revoke all on table public.epi_projects from anon, authenticated;
grant select, insert, update, delete on table public.epi_projects to authenticated;

drop policy if exists "Owners can read Epi projects" on public.epi_projects;
create policy "Owners can read Epi projects"
  on public.epi_projects for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can create Epi projects" on public.epi_projects;
create policy "Owners can create Epi projects"
  on public.epi_projects for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can update Epi projects" on public.epi_projects;
create policy "Owners can update Epi projects"
  on public.epi_projects for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can delete Epi projects" on public.epi_projects;
create policy "Owners can delete Epi projects"
  on public.epi_projects for delete
  to authenticated
  using ((select auth.uid()) = owner_id);
