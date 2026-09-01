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
  user_id uuid references auth.users (id) on delete set null, -- null for trips made anonymously (edit_token is still the only proof of ownership for those)
  is_public boolean not null default true,      -- false = only the owner (edit token or signed-in account) can view the share page
  created_at timestamptz not null default now()
);

create index if not exists trips_slug_idx on trips (slug);
create index if not exists trips_user_id_idx on trips (user_id);

-- Added after the table already existed in production -- `create table if
-- not exists` above is a no-op there, so this re-runnable statement is what
-- actually adds the column to an already-deployed database.
alter table trips add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table trips add column if not exists is_public boolean not null default true;
-- Custom moving-marker image for the Play animation (see TripView.tsx's
-- buildMotoMarkerEl). Null falls back to the owner's Google avatar,
-- resolved server-side in t/[slug]/page.tsx -- not cached here, so it
-- always reflects their current avatar without needing a sync job.
alter table trips add column if not exists marker_icon_path text;
-- AI-generated Vietnamese narrative of the trip (see src/lib/gemini.ts),
-- created on demand by the owner from route stats + a sample of photos.
-- Null until generated; feature is hidden entirely when GEMINI_API_KEY isn't set.
alter table trips add column if not exists story text;
-- Structured multi-stop version of the same AI story (see src/lib/gemini.ts
-- TripStory type) -- `story` above stays a flat summary+conclusion string
-- for the <meta description>, this holds the full per-stop timeline for
-- TripView's UI.
alter table trips add column if not exists story_json jsonb;

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

-- Soft rate limiting for trip creation (POST /api/trips), keyed by
-- "create_trip:{ip}:{yyyy-mm-dd}" from src/lib/rate-limit.ts. Not meant to be
-- airtight (increments aren't atomic, and IPs are spoofable/shared) -- just
-- enough friction to stop a naive script from filling up Storage for free.
create table if not exists rate_limits (
  key text primary key,
  count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table rate_limits enable row level security;
-- No policies added, same reasoning as trips/photos above: only ever touched
-- server-side via the service role key.

-- One row per event a signed-in trip owner should hear about (currently
-- just "someone liked your trip" -- see POST /api/trips/[slug]/like). Only
-- ever relevant to signed-in owners: an anonymous/edit-token-only trip has
-- no account to check notifications on later, so owner_user_id is required,
-- not nullable like trips.user_id is.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  trip_slug text not null,
  trip_title text,
  type text not null default 'like', -- only 'like' for now; kept as text (not an enum) so new types don't need a migration
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_owner_user_id_idx on notifications (owner_user_id, created_at desc);

alter table notifications enable row level security;
-- No policies added, same reasoning as trips/photos above: only ever touched
-- server-side via the service role key (GET/POST /api/notifications, POST
-- /api/trips/[slug]/like), which checks the caller's session itself.
