-- Platform spec 6.2, migration 1: every per-language table gets a language
-- column, defaulting to 'it' so every existing Chi è? row is Italian and the
-- launched Chi è? app keeps working unchanged until it is replaced (spec 5.2).
-- Copied from docs/spec.md; scripts/db.test.ts checks the two agree.

create table public.languages (
  code text primary key,
  created_at timestamptz not null default now()
);
insert into public.languages (code) values ('it'), ('zh');
alter table public.languages enable row level security; -- no policies: the app never reads it

alter table public.profiles add column last_language text references public.languages (code);

alter table public.games
  add column language text not null default 'it' references public.languages (code);
alter table public.review_log
  add column language text not null default 'it' references public.languages (code);
alter table public.cards
  add column language text not null default 'it' references public.languages (code);

alter table public.cards drop constraint cards_pkey;
alter table public.cards add primary key (user_id, language, lexicon_id, direction);

drop index public.review_log_user_created;
create index review_log_user_language_created on public.review_log (user_id, language, created_at);
create index games_user_language on public.games (user_id, language);

create table public.language_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  language text not null references public.languages (code),
  level smallint not null default 1 check (level in (1, 2)),
  updated_at timestamptz not null default now(),
  primary key (user_id, language)
);
insert into public.language_settings (user_id, language, level)
  select id, 'it', level from public.profiles;
alter table public.language_settings enable row level security;

create policy language_settings_select on public.language_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy language_settings_insert on public.language_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy language_settings_update on public.language_settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- A log row's game must be the same user's and the same language's.
drop policy review_log_insert on public.review_log;
create policy review_log_insert on public.review_log for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (game_id is null or exists (
      select 1 from public.games g
      where g.id = game_id
        and g.user_id = (select auth.uid())
        and g.language = review_log.language
    ))
  );
