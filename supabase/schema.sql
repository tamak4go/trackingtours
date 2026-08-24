-- Run this once in the Supabase project's SQL editor (Dashboard > SQL Editor > New query).
-- Everything here is accessed only through our Next.js API routes using the
-- SUPABASE_SERVICE_ROLE_KEY (server-side only, bypasses RLS). The anon key is
-- never used for direct table access, so RLS is left with no permissive
-- policies on purpose -- it just denies anonymous access by default.

create extension if not exists pgcrypto;

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  edit_token_hash text not null,
  title text,
  distance_km numeric,
  duration_ms bigint,
  route_mode text not null default 'straight', -- 'road' | 'straight'
  route_geojson jsonb,                          -- cached OSRM geometry, avoids re-calling routing on every view
  created_at timestamptz not null default now()
);

create index if not exists trips_slug_idx on trips (slug);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  storage_path text not null,
  lat double precision,
  lng double precision,
  taken_at timestamptz,
  sort_order int not null default 0,
  place_name text, -- owner-editable label shown on the stop card/lightbox; null until they set one
  created_at timestamptz not null default now()
);

create index if not exists photos_trip_id_idx on photos (trip_id);

-- Added after the table already existed in production -- `create table if
-- not exists` above is a no-op there, so this re-runnable statement is what
-- actually adds the column to an already-deployed database.
alter table photos add column if not exists place_name text;

alter table trips enable row level security;
alter table photos enable row level security;
-- No policies added: anon/authenticated roles get zero access to these tables.
-- All reads/writes happen server-side via the service role key.

-- Storage bucket for compressed trip photos, served via public read URLs.
-- The object paths are random (trip_id/photo_id.jpg), so they are only
-- discoverable through a trip's share link, not by browsing the bucket.
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', true)
on conflict (id) do nothing;

-- Public read of objects in this bucket only (still no insert/update/delete
-- for anon -- uploads go through the service role key in our API route).
-- CREATE POLICY has no IF NOT EXISTS, so drop-then-create for idempotency.
drop policy if exists "public read trip photos" on storage.objects;
create policy "public read trip photos"
  on storage.objects for select
  using (bucket_id = 'trip-photos');
