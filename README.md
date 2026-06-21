# Ref Watch (MVP)

A minimal Chrome extension that, while turned on, shows a poll about a referee's
call on the page you are viewing every minute, gives you 10 seconds to pick **Yes**
or **No**, and stores only the final choice in a Supabase table.

## How it works

Clicking the toolbar icon opens a small control panel with a single on/off toggle.
While the toggle is on, a background service worker (`background.js`) runs a
one-minute alarm. On each tick it asks the page you are currently viewing to draw a
small white poll card on top of that page (an in-page overlay from `content.js`)
with the question and two buttons. You can change your pick freely. After 10
seconds the overlay auto-submits whatever option is selected and then disappears.
If nothing is selected, nothing is stored. There is no animated countdown; the
overlay just states that 10 seconds are available, which keeps the code simple.

The poll only appears on the page that is active when the minute ticks. If that
page cannot host an overlay (such as a `chrome://` page, the Chrome Web Store, or
the new-tab page), that round is skipped rather than queued for later.

The overlay only collects the choice. The actual save to Supabase is performed by
the service worker, which keeps the network call out of the web page and avoids the
cross-origin restrictions a page-level request can hit.

## 1. Create the Supabase table

In your Supabase project's SQL editor, run:

```sql
create table votes (
  id bigint generated always as identity primary key,
  question text not null,
  choice text not null,
  created_at timestamptz not null default now()
);

alter table votes enable row level security;

create policy "anon can insert votes"
  on votes for insert
  to anon
  with check (true);
```

Row level security is enabled and only an `insert` policy is granted to the
anonymous role. The key in the extension is therefore safe to ship: anyone holding
it can add a vote but cannot read or modify existing rows.

## 2. Add your credentials

Open `config.js` and set your project's URL and key (Supabase dashboard → Project
Settings → API Keys). The code accepts either the new publishable key
(`sb_publishable_...`) or the legacy `anon` JWT key (`eyJ...`):

```js
const SUPABASE_CONFIG = {
  url: "https://your-project.supabase.co",
  anonKey: "your-key",
  table: "votes"
};
```

## 3. Load the extension locally

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Click the Ref Watch icon and switch the toggle on.

After loading or reloading the extension, reload any web page you already had open
so the overlay script is injected into it. Then the first poll appears one minute
after you turn the toggle on.

## Viewing votes

In the Supabase dashboard, open Table Editor and select the `votes` table, or run
this in the SQL Editor for a tally:

```sql
select choice, count(*)
from votes
group by choice
order by count(*) desc;
```

## Known MVP limits

- The overlay appears only on the active tab at the moment the minute ticks; other
  rounds for non-overlay pages are skipped.
- A freshly loaded or reloaded extension only injects its overlay into pages opened
  or refreshed afterward.
- Chrome alarms fire at a minimum interval of one minute, which is what we use.
- The question, the option labels, and the 10-second timer all live in `config.js`
  so they are easy to change.
