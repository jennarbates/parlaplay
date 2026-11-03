-- The Tutt* a tavola! workbook (/quaderno/): one row per user and workbook, holding
-- that workbook's progress as a document. The page merges it with its local copy
-- (src/quaderno/merge.ts), so there is nothing here for other tables to join on.

create table public.workbook_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  workbook text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, workbook),
  check (octet_length(data::text) <= 1000000)
);
alter table public.workbook_progress enable row level security;

create policy workbook_progress_select on public.workbook_progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy workbook_progress_insert on public.workbook_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy workbook_progress_update on public.workbook_progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
