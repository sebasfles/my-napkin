---
updated: 2026-09-20
source: 0012_libraries
---

# app: product

Everything below is built.

## Purpose

Sebastian gets his own Excalidraw on his own domain, with a list of diagrams that persist across sessions.
One user, no sign-up, priced to run at $0 fixed cost per month.

## Interface

The user opens `/`, is asked for the password once, and lands on his workspace with nothing open: the editor area invites him to pick a diagram or start one, and the app never picks for him.
The sidebar carries the app's name, My Napkin, and two sections the user switches between, Diagrams and Libraries: Diagrams holds the pinned ones when there are any and the contents of one folder under a breadcrumb of where that folder sits, Libraries holds every library he has made.
Below them sit the language and theme controls and a way to close the session.
It collapses to a narrow rail of icons when the drawing needs the room, and comes back from the same control or from Alt+B, which is how the room is taken and given back without leaving the drawing; both controls name the chord in their tooltip.
A bar of tabs sits above the canvas, one per diagram the user has open, and it is there only while something is open.
The browser tab names the diagram he is on before the product, so a window among many is recognisable before it is read, and carries the app's own mark.
Everything outside the canvas is set in the app's own typeface, with its monospaced companion for dates, sizes and counts; the canvas keeps the editor's own.
The interface starts in the browser's language, Spanish or English, and in its light or dark preference, and the editor follows both; either can be overridden from the sidebar and survives a reload, the theme keeping system as a choice of its own so the browser's preference can always be handed back.

## User flows

### Login

1. User opens any page or calls any API route and is sent to `/login` if there is no valid session, an API call being answered 401 instead.
2. User enters the password.
3. On success, a signed session cookie is set and the user lands where he was going, or on `/` if he came straight to the login page.
4. On failure, the form shows an error, the user stays on `/login`, and the answer takes half a second whatever the password was.
5. User closes the session from the sidebar and is back at `/login`.
6. A session that expires while the app is open sends the user back to `/login` rather than failing quietly.

### Browse and edit diagrams

1. User sees the folder he is in: its folders first, by name, then its diagrams, most recently edited first, each with the time since it was last drawn on, which keeps ageing and never runs ahead of the edit it describes.
2. User opens one; its drawing, pasted images included, comes back as it was left.
3. User draws; changes are saved on their own a second or two after the user stops.
4. User creates a diagram from the sidebar, in the folder he is looking at, and it opens right away.
5. Every diagram carries a menu: rename it, pin it, move it, lock it, read what it holds, or delete it.
6. Renaming happens in a dialog and does not count as editing: the diagram keeps its place in the list.
7. Info tells the user the name, the folder it sits in, when it was created, when it was last edited, since when it is pinned and locked, how many elements it holds and what its drawing weighs; a diagram not saved since these existed shows a dash rather than a guess.
8. Deleting asks for confirmation naming the diagram and cannot be undone.

### Organise with folders and pins

1. User creates a folder from the sidebar, names it in a dialog, and nothing is written if he changes his mind.
2. User opens a folder and the list becomes its contents; the breadcrumb above names the path from the top and every step of it is a way back.
   A path too long for the sidebar keeps its ends and hides the middle behind a menu, and a name too long for its crumb is cut short with the whole of it one hover away.
3. Folders nest as deep as the user wants, and a folder's menu renames, moves or deletes it.
4. User moves a diagram or a folder from its menu, choosing the destination from the whole tree.
   The tree never offers a folder itself or anything inside it, since that would put a branch somewhere it could never be reached from.
5. User pins a diagram from its menu and it joins a section above the list, in the order things were pinned, reachable from any folder.
   A pin is a shortcut, not a move: the diagram stays where it lives and shows in both places.
6. Deleting a folder asks for confirmation that says how many diagrams and folders are inside, and how many of those diagrams are locked, because it takes all of them; the diagrams it takes close their tabs, leaving the user on the tab beside them or on the empty workspace.
7. The folder the user was last looking at is where he finds himself after a reload, and opening a diagram takes the sidebar to the folder that diagram lives in.

### Keep several diagrams open

1. Opening a diagram puts it in a tab above the canvas, and the tab bar is where the user moves between the diagrams he is working on.
2. A diagram he only glanced at takes a single preview tab, written in italics: the next diagram he opens takes its place rather than adding to the row.
   A double click on the row or on the tab keeps it, and so does the first edit, which is what turns a glance into work in progress.
3. A tab closes from its own button or with Alt+W, and the user lands on the tab beside it, or back on the empty workspace when he closed the last one.
4. The keyboard reaches the tabs while the user is drawing: Alt and a digit jumps to that tab, Alt+Shift with an arrow moves to the next or the previous one, Alt+W closes.
   Nothing the editor binds is taken away.
5. A tab whose diagram was deleted closes itself, including every tab a deleted folder took with it.

### Build a library

1. User opens the Libraries section from the sidebar, or from its icon on the rail, and sees every library he has made with how many items each holds.
2. User creates one and it opens as a canvas, in a tab like a diagram and marked as a library.
3. Every frame he draws on that canvas is one library item, and the frame's name is the item's name.
   An empty canvas says so, and a frame holding an image says that images are not saved in a library item.
4. Drawing a frame and pausing saves the canvas, and the library reports one more item; deleting the frame takes the item with it.
5. Libraries are global: one lives outside the folders, is never pinned, locked or moved, and is reachable from wherever the user is.

### Lock a diagram

1. User locks a finished diagram from its menu; the row shows a lock and the editor opens it read only.
2. A locked diagram can still be panned, zoomed and read, and never saves, whatever any browser still has it open.
3. User unlocks it from the same menu to draw again; deleting asks for the unlock first, so nothing finished is lost by one click.
4. Renaming, pinning and moving a locked diagram stay allowed: the lock protects the drawing, not where it sits or what it is called.

With nothing open, the editor area says so and offers to create a diagram, in the folder the sidebar is showing.
That is where a new browser starts, where closing the last tab returns, and where an address naming a diagram that no longer exists lands; the app creates nothing on its own, so an empty workspace stays empty until the user asks.
A folder with nothing in it says so.
A new diagram is named after the day, `Napkin DDMMYYYY`, and repeats that day get `(2)`, `(3)`.
The open diagram shows a passive save indicator where its date would be: saved, saving, or not saved.
A failed save says so and goes through on the next change; the user is warned before leaving with work still unsaved.
A list that cannot be loaded offers to try again rather than pretending to be empty.

## Rules

- Only one user; there is no concept of ownership or sharing per diagram or library.
- A library is a canvas, not a list: it is edited in the same editor as a diagram, and its items are whatever its frames are at the last save.
- A locked diagram is refused by the server, not only by the browser that locked it.
- Which diagrams are open, where the user is in the tree and whether the sidebar is a rail are remembered per browser; the address names the open diagram and nothing else, so no link points at a folder or at a set of tabs.
- A diagram's saved scene includes any pasted images, so they survive closing and reopening.
- Static assets are public; no diagram data is public.
- A valid session lasts 30 days, after which the user must log in again.

## Out of scope

The same list as the product's, in `docs/PRD.md` under Not in the product.

## Open questions

- None.
