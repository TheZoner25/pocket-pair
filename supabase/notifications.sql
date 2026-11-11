-- Pocket Pair notifications (v1.1). Run after schema.sql. Safe to run again.
-- Flow: status change / heart / note -> trigger -> pg_net POST -> edge function pair-notify -> Web Push.

create extension if not exists pg_net;

-- Server-only settings (pair_config is unreadable from the app). Fill these with:
--   update pair_config set notify_url = 'https://<project>.supabase.co/functions/v1/pair-notify',
--     notify_secret = '<random>', vapid_public = '<key>', vapid_private = '<key>', vapid_subject = 'mailto:you@example.com';
alter table public.pair_config
  add column if not exists notify_url text,
  add column if not exists notify_secret text,
  add column if not exists vapid_public text,
  add column if not exists vapid_private text,
  add column if not exists vapid_subject text;

-- "This person has the app open right now": the app pushes this 45 s ahead while visible.
alter table public.pair_status add column if not exists visible_until timestamptz;
grant update (visible_until) on public.pair_status to authenticated;

-- One row per phone/computer that turned notifications on.
create table if not exists public.pair_push_subs (
  endpoint text primary key,
  who text not null check (who in ('rocky', 'her')),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  want_status boolean not null default true,
  want_love boolean not null default true,
  want_notes boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.pair_push_subs enable row level security;
revoke all on public.pair_push_subs from anon;

drop policy if exists "own subs read" on public.pair_push_subs;
create policy "own subs read" on public.pair_push_subs for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "own subs add" on public.pair_push_subs;
create policy "own subs add" on public.pair_push_subs for insert to authenticated
  with check (user_id = auth.uid() and who = public.pair_me());
drop policy if exists "own subs change" on public.pair_push_subs;
create policy "own subs change" on public.pair_push_subs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and who = public.pair_me());
drop policy if exists "own subs remove" on public.pair_push_subs;
create policy "own subs remove" on public.pair_push_subs for delete to authenticated
  using (user_id = auth.uid());

-- Trigger: hand the event to the edge function.
create or replace function public.pair_notify() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare c record; ev jsonb;
begin
  select notify_url, notify_secret into c from public.pair_config where id = 1;
  if c.notify_url is null or c.notify_secret is null then return new; end if;
  if tg_table_name = 'pair_status' then
    if new.act is not distinct from old.act then return new; end if;
    ev := jsonb_build_object('kind', 'status', 'from', new.who,
            'to', case when new.who = 'rocky' then 'her' else 'rocky' end, 'act', new.act);
  else
    ev := jsonb_build_object('kind', new.kind, 'from', new.from_who, 'to', new.to_who, 'secs', new.secs);
  end if;
  perform net.http_post(
    url := c.notify_url,
    body := ev,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pair-secret', c.notify_secret),
    timeout_milliseconds := 5000);
  return new;
end $$;
revoke all on function public.pair_notify() from public, anon, authenticated;

drop trigger if exists pair_status_notify on public.pair_status;
create trigger pair_status_notify after update of act on public.pair_status
  for each row execute function public.pair_notify();
drop trigger if exists pair_events_notify on public.pair_events;
create trigger pair_events_notify after insert on public.pair_events
  for each row execute function public.pair_notify();
