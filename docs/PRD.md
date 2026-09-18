---
updated: 2026-09-17
source: setup
---

# Product Requirements Document

## Product

my-napkin is a personal Excalidraw hosted on Sebastian's own domain, `napkin.sdfles.com`.
It gives him a list of named diagrams that persist between sessions and devices, with the same editor as excalidraw.com, behind a single password.
The priorities are, in order: it works, it costs nothing fixed per month, and it stays trivial to update when Excalidraw ships a new version.

## Users

- Sebastian: the only user. He opens the site, unlocks it once per device, picks or creates a diagram, draws, and expects it to be there next time.

## Capabilities

### Diagrams (module `app`)

The user sees his diagrams in a side list, creates a new one, renames or deletes it, and opens one in the editor.
Edits save automatically shortly after he stops drawing, including pasted images.
Reopening a diagram restores it as it was left.
Details: [modules/app/prd.md](modules/app/prd.md)

### Access (module `app`)

The site asks for one password the first time a browser visits.
After that the browser stays unlocked for 30 days.
Details: [modules/app/prd.md](modules/app/prd.md)

### Hosting (modules `infra`, `deploy`)

The site lives on AWS under the user's domain with TLS and is deployed automatically whenever `main` changes.
The user never touches a server; the only manual operations are applying infrastructure changes and setting the password.
Details: [modules/infra/prd.md](modules/infra/prd.md), [modules/deploy/prd.md](modules/deploy/prd.md)

## Cross-cutting rules

- One user, one password, no accounts.
- Every diagram is private; nothing is reachable without the unlocked browser.
- The editor is the upstream Excalidraw package, unmodified; the product does not diverge from its behavior.
- The project, its domain and its AWS resources are named `napkin`; the Excalidraw name appears only as a credit in the README.
- Fixed monthly cost stays at $0 inside the AWS free tier.
- The interface is available in Spanish and English, following the browser and switchable from the sidebar.
- Light and dark mode follow the system and can be switched from the sidebar; the editor follows the same theme.
- A change reaches the user only after it ran on `napkin.dev.sdfles.com` and its end-to-end tests passed there.

## Not in the product

- Live collaboration.
- Shared or public links.
- Multiple users or roles.
- Folders, tags or search over diagrams.
- Mobile-specific UI beyond what the Excalidraw package already gives.

## Open questions

- The diagram list shows name and last update only, no thumbnail.
- A failed save shows a passive indicator, never a blocking message.
