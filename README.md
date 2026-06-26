# VARdict

**Vote on controversial calls in real time.**

VARdict is a lightweight Manifest V3 Chrome extension for World Cup matches. While
it's on, it watches the live match and pops a small poll onto the page you're
viewing whenever the referee shows a card or a VAR review happens. You get a few
seconds to vote Yes or No on whether it was the right call, and your anonymous
answer is stored in Supabase.

Built with plain JavaScript, HTML, and CSS — no frameworks or build step.

## How it works

The toolbar icon opens a control panel with an on/off toggle, saved in
`chrome.storage.local`. While it's on, the content script on your visible tab polls
every 20 seconds and asks the background service worker to check for new events. The
worker finds the live World Cup fixture and its event timeline, remembers how many
events it has already seen, and returns the latest new card or VAR. The overlay then
shows a contextual question (player, team, minute), and your vote is saved to
Supabase. The first check after enabling primes silently, so you don't see a backlog.

Voting: the overlay lasts up to 20 seconds; once you pick an option it auto-submits
after 5 seconds unless you change it (changing resets the 5s timer).

Results: after you vote, the overlay shows a Yes/No percentage bar for that question
once it has more than `POLL.resultsThreshold` votes (it waits and re-checks for a
short while, since votes arrive over time). If several cards happen at once, it
collects your vote on each first, then shows the bars. Vote counts are never shown —
only the percentage split.

## Architecture

- `popup.html` / `popup.js` / `popup.css` — the on/off control panel.
- `content.js` — polls on the visible tab and renders the in-page poll overlay.
- `background.js` — service worker: finds the live fixture, pulls events, de-duplicates,
  builds the question, and saves votes to Supabase.
- `supabase/functions/refwatch-events/` — Edge Function that proxies API-Football so
  the paid API key stays server-side, never in the shipped extension.
- `config.js` — client settings (gitignored; copy from `config.example.js`).

## Data sources

- **API-Football** (api-sports.io), `league = 1`, `season = 2026`, for live cards and
  VAR events. A paid plan is required — the free tier is historical only (2022–2024)
  and returns nothing for the current season. The API key lives only in the Edge
  Function secret.
- **Supabase** (PostgreSQL) stores votes. Row-level security exposes an insert-only
  policy, so the publishable key shipped in the extension can add votes but never read
  or change data.

We trigger on cards and VAR because individual fouls and live commentary aren't
available on affordable feeds, and cards/VAR are the genuinely controversial calls.

## Setup

### 1. Supabase table

```sql
create table if not exists votes (
  id bigint generated always as identity primary key,
  question text not null,
  choice text not null,
  created_at timestamptz not null default now()
);

alter table votes enable row level security;

drop policy if exists "anon can insert votes" on votes;
create policy "anon can insert votes"
  on votes for insert
  to anon
  with check (true);

-- Aggregates only, so the insert-only key can read a Yes/No breakdown
-- without exposing individual rows.
create or replace function vote_breakdown(q text)
returns table(total bigint, yes bigint, no bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*) as total,
    count(*) filter (where choice = 'Yes') as yes,
    count(*) filter (where choice = 'No') as no
  from votes
  where question = q;
$$;

grant execute on function vote_breakdown(text) to anon;
```

### 2. Deploy the API-Football proxy

```bash
brew install supabase/tap/supabase
supabase login
supabase secrets set APIFOOTBALL_KEY=your-api-football-key --project-ref YOUR_REF
supabase functions deploy refwatch-events --no-verify-jwt --project-ref YOUR_REF
```

Optional: `supabase secrets set ALLOWED_APIKEY=your-supabase-publishable-key` to
restrict the function to callers that send your publishable key. The league and
season are set inside the function.

### 3. Client config

```bash
cp config.example.js config.js
```

Fill in your Supabase URL, publishable key, and function URL. `config.js` is
gitignored, so real values are never committed.

### 4. Load the extension

Open `chrome://extensions`, enable Developer mode, click **Load unpacked**, and
select this folder. Refresh the tab you'll watch on, then switch the toggle on
during a live match.

## Configuration

In `config.js`:

- `APIFOOTBALL_CONFIG.pollSeconds` — poll interval (default 20).
- `APIFOOTBALL_CONFIG.triggerTypes` — `["Card", "Var"]`; add `"Goal"` to also poll on goals.
- `POLL.decisionSeconds` — max overlay time (20); `POLL.confirmSeconds` — auto-submit
  delay after a pick (5).
- `POLL.resultsThreshold` — show the results bar once a question has more than this
  many votes (default 1; set to 0 to see the bar after your own vote when testing).

## Viewing votes

In Supabase, open Table Editor → `votes`, or run this in the SQL editor to see each
question and its vote breakdown:

```sql
select question,
       count(*) as votes,
       count(*) filter (where choice = 'Yes') as yes,
       count(*) filter (where choice = 'No') as no
from votes
group by question
order by votes desc;
```

(Reading from the terminal would need a service-role key, since the shipped key is
insert-only; the Supabase SQL editor is the easy path.)

## Packaging for the Chrome Web Store

The runtime package is built with only the files the extension needs:

```bash
zip -r dist/vardict-1.0.0.zip manifest.json popup.html popup.css popup.js \
  content.js background.js config.js icons
```

This excludes `.git`, `supabase/`, `store/`, and config extras. Store assets
(privacy policy and listing copy) are in `store/`.

## Limitations

- Polls only on the visible tab, and the overlay appears on whatever normal page is
  in focus (not `chrome://` or new-tab pages).
- Events surface within the poll interval plus the feed's own ~15s delay, so a popup
  can lag the live action (and is usually ahead of a delayed stream).
- If a card happens while you're away, you get one catch-up popup for the latest one
  on return; earlier ones in that gap are skipped.
