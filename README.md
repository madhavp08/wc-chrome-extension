# Ref Watch (MVP)

A minimal Chrome extension that asks one question about a referee's call, gives the
user 15 seconds to pick **Yes** or **No**, and stores only the final choice in a
Supabase table.

## How it works

Clicking the toolbar icon opens a plain white popup with the question and two
buttons. The user can change their pick freely. After 15 seconds the popup
auto-submits whatever option is currently selected to Supabase. If nothing is
selected, nothing is stored. There is no animated countdown; the popup just states
that 15 seconds are available, which keeps the code simple.

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
anonymous role. The anon key is therefore safe to ship in the extension: anyone
holding it can add a vote but cannot read or modify existing rows.

## 2. Add your credentials

Open `config.js` and replace the placeholders with your project's URL and anon key
(Supabase dashboard → Project Settings → API):

```js
const SUPABASE_CONFIG = {
  url: "https://your-project.supabase.co",
  anonKey: "your-anon-key",
  table: "votes"
};
```

## 3. Load the extension locally

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Click the Ref Watch icon in the toolbar to open the popup.

When you are ready to share it, the same folder is what you upload to the Chrome
Web Store.

## Known MVP limits

- A Chrome popup closes if it loses focus, which stops the 15-second timer. Keep
  the popup open to let the vote save. A persistent on-page overlay can replace
  this later.
- The question and timer length live in `config.js` so they are easy to change.
