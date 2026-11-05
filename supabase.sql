-- Daily Fit: online storage. Paste into Supabase → SQL Editor → Run. Safe to run again.
-- Each user gets one row with their closet data, plus a private photo folder that only they can open.

create table if not exists public.user_state (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;

drop policy if exists "read own closet" on public.user_state;
drop policy if exists "create own closet" on public.user_state;
drop policy if exists "update own closet" on public.user_state;
drop policy if exists "delete own closet" on public.user_state;
create policy "read own closet"   on public.user_state for select to authenticated using (auth.uid() = user_id);
create policy "create own closet" on public.user_state for insert to authenticated with check (auth.uid() = user_id);
create policy "update own closet" on public.user_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own closet" on public.user_state for delete to authenticated using (auth.uid() = user_id);

-- Private bucket for clothing photos: files live under <user id>/...
insert into storage.buckets (id, name, public, file_size_limit)
values ('photos', 'photos', false, 10485760)
on conflict (id) do update set public = false;

drop policy if exists "read own photos" on storage.objects;
drop policy if exists "upload own photos" on storage.objects;
drop policy if exists "update own photos" on storage.objects;
drop policy if exists "delete own photos" on storage.objects;
create policy "read own photos"   on storage.objects for select to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "upload own photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own photos" on storage.objects for update to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photos" on storage.objects for delete to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Tiny public function the daily GitHub job calls, so the free project never pauses for inactivity.
create or replace function public.ping() returns text language sql stable as $$ select 'ok'::text $$;
grant execute on function public.ping() to anon;
