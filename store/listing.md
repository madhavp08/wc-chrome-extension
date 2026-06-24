# Chrome Web Store listing — Ref Watch

> Placeholder name/branding until the rebrand. Update name, icon, and screenshots
> before final submission.

## Name

Ref Watch

## Summary (max 132 characters)

Vote Yes or No on controversial referee calls — cards and VAR — live during World Cup matches.

## Category

Sports

## Description

Ref Watch turns every controversial referee decision into a quick vote. Turn it on,
watch the match, and when the referee shows a yellow or red card — or a VAR review
happens — a small poll appears on your screen asking whether it was the right call.
You get a few seconds to choose Yes or No, and your answer is recorded so everyone
can see how fans really feel.

- Pops up automatically on cards and VAR during live World Cup matches.
- A clean, minimal overlay on the page you are already watching.
- One tap to vote — nothing else to manage.
- Turn it on or off any time from the toolbar.

Ref Watch is anonymous. It never asks who you are, and it does not read the pages
you visit — the only thing it records is your Yes/No opinion on a referee decision.

## Single purpose (required field)

Ref Watch displays a Yes/No poll about controversial referee decisions (cards and
VAR) during live matches and records the user's response.

## Permission justifications

- **Host access — "Read and change data on all websites" (`<all_urls>`):** Required
  to draw the poll overlay on top of whatever page the user is watching the match on
  (for example, a streaming site). The extension injects only its own overlay UI; it
  does not read, collect, or transmit the contents of any page.
- **`storage`:** Stores a single on/off setting so the extension remembers whether
  auto-polling is enabled.
- **Remote requests to our Supabase backend:** Used to fetch live match events and
  to record the user's vote. The extension does not download or execute remote code.

## Data practices (Privacy tab)

- Collected: user-provided poll responses (Yes/No) and the referee-decision text they
  refer to.
- Not collected: personally identifiable information, location, web browsing history,
  website content, authentication information.
- Certifications to confirm: data is not sold; not used or transferred for purposes
  unrelated to the single purpose above; not used to determine creditworthiness or for
  lending.

## Privacy policy URL

Host `store/PRIVACY.md` (e.g., GitHub Pages or a public gist) and paste its public
URL into the listing's privacy policy field.

## Assets still needed before submission

- 128×128 store icon (plus 16/48 for the manifest) — from the rebrand.
- At least one screenshot at 1280×800 or 640×400 (capture the toolbar popup and the
  in-page overlay during a match).
