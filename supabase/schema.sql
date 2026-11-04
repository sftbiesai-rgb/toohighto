-- Too High To… — database schema for Supabase.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to re-run: tables use IF NOT EXISTS and functions use CREATE OR REPLACE.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- body is the part after "Too high to", e.g. "smoke more weed".
-- body_key is a normalized copy used to reject case/space-insensitive duplicates.
-- base_score lets the seed rows start in a sensible order; real votes add to it.
create table if not exists public.statements (
  id          uuid primary key default gen_random_uuid(),
  body        text not null check (char_length(body) between 3 and 80),
  body_key    text generated always as (lower(regexp_replace(btrim(body), '\s+', ' ', 'g'))) stored unique,
  base_score  integer not null default 0,
  score       integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists statements_rank_idx on public.statements (score desc, created_at asc);
create index if not exists statements_new_idx  on public.statements (created_at desc);

-- One vote per statement per anonymous browser id. +1 = higher, -1 = lower.
create table if not exists public.votes (
  statement_id uuid not null references public.statements (id) on delete cascade,
  voter_id     uuid not null,
  value        smallint not null check (value in (-1, 1)),
  created_at   timestamptz not null default now(),
  primary key (statement_id, voter_id)
);

create index if not exists votes_voter_idx on public.votes (voter_id);

-- ---------------------------------------------------------------------------
-- Access: the public may only READ statements. Every write goes through the
-- functions below. votes has RLS on and no policies, so it is fully private.
-- ---------------------------------------------------------------------------

alter table public.statements enable row level security;
alter table public.votes      enable row level security;

drop policy if exists "public read" on public.statements;
create policy "public read" on public.statements for select to anon, authenticated using (true);

revoke all on public.statements, public.votes from anon, authenticated;
grant select (id, body, score, created_at) on public.statements to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Write functions
-- ---------------------------------------------------------------------------

create or replace function public.submit_statement(p_body text)
returns table (id uuid, body text, score integer, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
begin
  v_body := regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', '', 'g');
  v_body := regexp_replace(btrim(v_body), '\s+', ' ', 'g');
  v_body := regexp_replace(v_body, '^too high to\s*', '', 'i');  -- people will type the prefix anyway
  v_body := btrim(v_body);

  if char_length(v_body) < 3 then raise exception 'TOO_SHORT'; end if;
  if char_length(v_body) > 80 then raise exception 'TOO_LONG'; end if;

  begin
    return query
      insert into statements as s (body) values (v_body)
      returning s.id, s.body, s.score, s.created_at;
  exception when unique_violation then
    raise exception 'DUPLICATE';
  end;
end;
$$;

-- p_value: 1 = higher, -1 = lower, 0 = take my vote back. Returns the new score.
create or replace function public.cast_vote(p_statement_id uuid, p_voter_id uuid, p_value integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score integer;
begin
  if p_value is null or p_value not in (-1, 0, 1) then raise exception 'BAD_VOTE'; end if;

  -- Serialize votes per statement so the recomputed score is never stale.
  perform 1 from statements where id = p_statement_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if p_value = 0 then
    delete from votes where statement_id = p_statement_id and voter_id = p_voter_id;
  else
    insert into votes (statement_id, voter_id, value)
    values (p_statement_id, p_voter_id, p_value)
    on conflict (statement_id, voter_id) do update set value = excluded.value;
  end if;

  update statements s
     set score = s.base_score + coalesce((select sum(v.value) from votes v where v.statement_id = s.id), 0)
   where s.id = p_statement_id
  returning s.score into v_score;

  return v_score;
end;
$$;

-- Lets a browser see its own votes so the buttons show their state.
create or replace function public.my_votes(p_voter_id uuid)
returns table (statement_id uuid, value smallint)
language sql
stable
security definer
set search_path = public
as $$
  select v.statement_id, v.value from votes v where v.voter_id = p_voter_id;
$$;

revoke execute on function public.submit_statement(text)           from public;
revoke execute on function public.cast_vote(uuid, uuid, integer)   from public;
revoke execute on function public.my_votes(uuid)                   from public;
grant  execute on function public.submit_statement(text)           to anon, authenticated;
grant  execute on function public.cast_vote(uuid, uuid, integer)   to anon, authenticated;
grant  execute on function public.my_votes(uuid)                   to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: every starter at score 1; ties rank oldest first, so list order wins.
-- ---------------------------------------------------------------------------

insert into public.statements (body, base_score, score, created_at)
select body, 1, 1, now() - (age || ' minutes')::interval
from (values
  ('blow leaves',                                         12),
  ('shovel',                                              11),
  ('pick up takeout',                                     10),
  ('smoke more weed',                                      9),
  ('vote',                                                 8),
  ('watch sports',                                         7),
  ('give out Halloween candy',                             6),
  ('cook hot dogs',                                        5),
  ('leave my closet for fear of seeing my work phone',     4),
  ('be out of the fetal position',                         3),
  ('properly achieve the fetal position',                  2),
  ('send a text about the dreams I had when I was high',   1)
) as seed (body, age)
on conflict (body_key) do nothing;
