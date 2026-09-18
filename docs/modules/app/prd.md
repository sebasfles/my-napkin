---
updated: 2026-09-17
source: setup
---

# app: product

No code exists yet. This describes the planned behavior, stated as planned.

## Purpose

Sebastian gets his own Excalidraw on his own domain, with a list of diagrams that persist across sessions.
One user, no sign-up, priced to run at $0 fixed cost per month.

## User flows

### Login

1. User opens the app and is redirected to `/login` if there is no valid session.
2. User enters the password.
3. On success, a signed session cookie is set and the user lands on `/`.
4. On failure, the form shows an error and the user stays on `/login`.

### Browse and edit diagrams

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

- Live collaboration between multiple people.
- Shared or public links to a diagram.
- Multiple user accounts.
- Folders to organize diagrams.
- Search across diagrams.

## Open questions

- None.
