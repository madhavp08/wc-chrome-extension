-- Run in the Supabase SQL editor before / after store release.
-- Ensures vote_breakdown counts Valid/Invalid (polls) and Goal/Miss (penalties).

create or replace function vote_breakdown(q text)
returns table(total bigint, yes bigint, no bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*) as total,
    count(*) filter (where choice in ('Valid', 'Goal')) as yes,
    count(*) filter (where choice in ('Invalid', 'Miss')) as no
  from votes
  where question = q;
$$;

grant execute on function vote_breakdown(text) to anon;
