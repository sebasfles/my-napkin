---
updated: 2026-09-18
source: 0004_diagram_persistence
---

# app: product

Everything below is built.

## Purpose

Sebastian gets his own Excalidraw on his own domain, with a list of diagrams that persist across sessions.
One user, no sign-up, priced to run at $0 fixed cost per month.

## Interface

The user opens `/`, is asked for the password once, and lands on a diagram, with the editor filling the viewport beside a sidebar.
The sidebar carries the app name, the diagram list, the two controls that change how everything looks, language and theme, and a way to close the session.
The interface starts in the browser's language, Spanish or English, and in the browser's light or dark preference, and the editor itself follows both.
Either choice can be overridden from the sidebar and survives a reload.
The theme offers system, light and dark, so it can be handed back to the browser's preference at any time and follows it again as it changes.

## User flows

### Login

1. User opens any page or calls any API route and is sent to `/login` if there is no valid session, an API call being answered 401 instead.
2. User enters the password.
3. On success, a signed session cookie is set and the user lands where he was going, or on `/` if he came straight to the login page.
4. On failure, the form shows an error, the user stays on `/login`, and the answer takes half a second whatever the password was.
5. User closes the session from the sidebar and is back at `/login`.
6. A session that expires while the app is open sends the user back to `/login` rather than failing quietly.

### Browse and edit diagrams

1. User sees the diagrams in the sidebar, most recently updated first, each with the time since its last change.
2. User opens one; its drawing, pasted images included, comes back as it was left.
3. User draws; changes are saved on their own a second or two after the user stops.
4. User creates a diagram from the sidebar, which opens right away, or renames one in place.
5. User deletes one, which asks for confirmation naming the diagram and cannot be undone.

There is no empty state: the user always has a diagram open, and the app creates the first one when none exists.
A new diagram is named after the day, `Napkin DDMMYYYY`, and repeats that day get `(2)`, `(3)`.
The open diagram shows a passive save indicator where its date would be: saved, saving, or not saved.
A failed save says so and goes through on the next change; the user is warned before leaving with work still unsaved.
A list that cannot be loaded offers to try again rather than pretending to be empty.

## Rules

- Only one user; there is no concept of ownership or sharing per diagram.
- A diagram's saved scene includes any pasted images, so they survive closing and reopening.
- Static assets are public; no diagram data is public.
- A valid session lasts 30 days, after which the user must log in again.

## Out of scope

The same list as the product's, in `docs/PRD.md` under Not in the product.

## Open questions

- None.
