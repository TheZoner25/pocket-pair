-- Pocket Pair: database setup for Supabase.
-- Paste all of this into Supabase > SQL Editor > New query, change the pair code
-- on the line marked CHANGE ME, and press Run. Safe to run again later.
-- Every table starts with pair_ so it sits next to anything else in the project.

-- 1. Who belongs to the pair -------------------------------------------------

create table if not exists public.pair_config (
  id int primary key default 1 check (id = 1),
  join_code text not null
);
-- CHANGE ME: the secret code you both type once when joining.
insert into public.pair_config (id, join_code) values (1, 'CHANGE-ME-1234')
  on conflict (id) do nothing;

create table if not exists public.pair_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  who text not null unique check (who in ('rocky', 'her')),
  name text not null default '',
  created_at timestamptz not null default now()
);

-- 2. Status, love counter, inbox ---------------------------------------------

create table if not exists public.pair_status (
  who text primary key check (who in ('rocky', 'her')),
  act text not null default 'idle',
  love_sent int not null default 0,
  updated_at timestamptz not null default now(),
  last_seen timestamptz
);
insert into public.pair_status (who) values ('rocky'), ('her') on conflict (who) do nothing;

create table if not exists public.pair_events (
  id bigint generated always as identity primary key,
  from_who text not null check (from_who in ('rocky', 'her')),
  to_who text not null check (to_who in ('rocky', 'her')),
  kind text not null check (kind in ('love', 'voice', 'art')),
  secs int,
  path text,
  art jsonb,
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  check (from_who <> to_who)
);
create index if not exists pair_events_inbox on public.pair_events (to_who, created_at desc);

-- 3. Helper functions ----------------------------------------------------------

-- Which seat ('rocky' or 'her') the signed-in user holds, or null.
create or replace function public.pair_me() returns text
language sql stable security definer set search_path = public as $$
  select who from public.pair_members where user_id = auth.uid()
$$;

-- Join with the pair code. A seat that someone else holds cannot be taken.
create or replace function public.pair_join(p_code text, p_who text, p_name text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if p_code is distinct from (select join_code from public.pair_config where id = 1) then
    raise exception 'That pair code is not right.';
  end if;
  if p_who not in ('rocky', 'her') then raise exception 'Pick Rocky or Hazel.'; end if;
  if exists (select 1 from public.pair_members where who = p_who and user_id <> auth.uid()) then
    raise exception 'Someone already joined in that seat.';
  end if;
  delete from public.pair_members where user_id = auth.uid();
  insert into public.pair_members (user_id, who, name)
    values (auth.uid(), p_who, upper(left(regexp_replace(coalesce(p_name, ''), '[^A-Za-z]', '', 'g'), 6)));
  return p_who;
end $$;

-- Send a heart: bumps your counter and drops a heart in the other inbox.
create or replace function public.pair_send_love() returns int
language plpgsql security definer set search_path = public as $$
declare me text := public.pair_me(); n int;
begin
  if me is null then raise exception 'Not part of the pair.'; end if;
  update public.pair_status set love_sent = love_sent + 1, last_seen = now() where who = me
    returning love_sent into n;
  insert into public.pair_events (from_who, to_who, kind)
    values (me, case when me = 'rocky' then 'her' else 'rocky' end, 'love');
  return n;
end $$;

revoke all on function public.pair_me() from public, anon;
revoke all on function public.pair_join(text, text, text) from public, anon;
revoke all on function public.pair_send_love() from public, anon;
grant execute on function public.pair_me() to authenticated;
grant execute on function public.pair_join(text, text, text) to authenticated;
grant execute on function public.pair_send_love() to authenticated;

-- 4. Row level security: only the two of you can read or write -----------------

alter table public.pair_config enable row level security;   -- no policies: nobody reads the code
alter table public.pair_members enable row level security;
alter table public.pair_status enable row level security;
alter table public.pair_events enable row level security;

revoke all on public.pair_config, public.pair_members, public.pair_status, public.pair_events from anon;
revoke all on public.pair_config from authenticated;

drop policy if exists "members read" on public.pair_members;
create policy "members read" on public.pair_members for select to authenticated
  using (public.pair_me() is not null or user_id = auth.uid());
drop policy if exists "member renames self" on public.pair_members;
create policy "member renames self" on public.pair_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.pair_members from authenticated;
grant update (name) on public.pair_members to authenticated;

drop policy if exists "status read" on public.pair_status;
create policy "status read" on public.pair_status for select to authenticated
  using (public.pair_me() is not null);
drop policy if exists "status write own" on public.pair_status;
create policy "status write own" on public.pair_status for update to authenticated
  using (who = public.pair_me()) with check (who = public.pair_me());
revoke insert, update, delete on public.pair_status from authenticated;
grant update (act, updated_at, last_seen) on public.pair_status to authenticated;

drop policy if exists "events read" on public.pair_events;
create policy "events read" on public.pair_events for select to authenticated
  using (public.pair_me() in (from_who, to_who));
drop policy if exists "events send" on public.pair_events;
create policy "events send" on public.pair_events for insert to authenticated
  with check (from_who = public.pair_me() and kind in ('voice', 'art'));
drop policy if exists "events mark seen" on public.pair_events;
create policy "events mark seen" on public.pair_events for update to authenticated
  using (to_who = public.pair_me()) with check (to_who = public.pair_me());
drop policy if exists "events clear own inbox" on public.pair_events;
create policy "events clear own inbox" on public.pair_events for delete to authenticated
  using (to_who = public.pair_me());
revoke update on public.pair_events from authenticated;
grant update (seen) on public.pair_events to authenticated;

-- 5. Live updates ---------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pair_status') then
    alter publication supabase_realtime add table public.pair_status;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pair_events') then
    alter publication supabase_realtime add table public.pair_events;
  end if;
end $$;

-- 6. Voice note storage (private bucket, 2 MB per note) -------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pair-notes', 'pair-notes', false, 2097152,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'])
on conflict (id) do nothing;

drop policy if exists "pair notes read" on storage.objects;
create policy "pair notes read" on storage.objects for select to authenticated
  using (bucket_id = 'pair-notes' and public.pair_me() is not null);
drop policy if exists "pair notes upload" on storage.objects;
create policy "pair notes upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'pair-notes' and (storage.foldername(name))[1] = public.pair_me());
drop policy if exists "pair notes delete" on storage.objects;
create policy "pair notes delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pair-notes' and public.pair_me() is not null);
