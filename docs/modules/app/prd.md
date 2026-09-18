---
updated: 2026-09-18
source: 0005_password_auth
---

# app: product

The shell and the login behave as described below under Interface.
Browsing diagrams is still planned.

## Purpose

Sebastian gets his own Excalidraw on his own domain, with a list of diagrams that persist across sessions.
One user, no sign-up, priced to run at $0 fixed cost per month.

## Interface

The user opens `/`, is asked for the password once, and gets the editor filling the viewport beside a sidebar.
The sidebar carries the app name, the diagram list, the two controls that change how everything looks, language and theme, and a way to close the session.
The interface starts in the browser's language, Spanish or English, and in the browser's light or dark preference, and the editor itself follows both.
Either choice can be overridden from the sidebar and survives a reload.

## User flows

Login works; browsing diagrams is planned, and today the sidebar shows an empty list and nothing is saved.

### Login

1. User opens any page or calls any API route and is sent to `/login` if there is no valid session, an API call being answered 401 instead.
2. User enters the password.
3. On success, a signed session cookie is set and the user lands where he was going, or on `/` if he came straight to the login page.
4. On failure, the form shows an error, the user stays on `/login`, and the answer takes half a second whatever the password was.
5. User closes the session from the sidebar and is back at `/login`.

### Browse and edit diagrams

Planned.

1. User sees a list of diagrams on the side and the editor in the center.
2. User opens a diagram; its scene loads into the editor via `initialData`.
3. User draws; changes are saved automatically a second or two after the user stops typing or drawing.
4. User can create a new diagram, rename one, or delete one from the list.

Errors and empty states: an empty list shows no diagrams yet, with a way to create the first one.
A failed save shows a passive indicator next to the diagram name and retries on the next change.

## Rules

- Only one user; there is no concept of ownership or sharing per diagram.
- A diagram's saved scene includes any pasted images, so they survive closing and reopening.
- Static assets are public; no diagram data is public.
- A valid session lasts 30 days, after which the user must log in again.

## Out of scope

The same list as the product's, in `docs/PRD.md` under Not in the product.

## Open questions

- None.
