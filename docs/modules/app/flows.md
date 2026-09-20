---
updated: 2026-09-20
source: 0011_workspace_redesign
---

# app: flows

Both flows are built.

## Login

The gate is `src/proxy.ts` and runs on every request whose path is not on the allowlist: `/login`, `/api/login`, `/_next/*` and root-level files.

```mermaid
stateDiagram-v2
  [*] --> Anonymous
  Anonymous --> LoginForm: no valid cookie, the gate redirects with next
  LoginForm --> Authenticated: correct password, cookie set, back to next
  LoginForm --> LoginForm: wrong password, error shown after a fixed delay
  Authenticated --> Anonymous: cookie expires after 30 days, or logout
```

```mermaid
sequenceDiagram
  participant U as User
  participant P as Proxy
  participant A as POST /api/login
  U->>P: request any protected route
  P->>P: verify the cookie signature and expiry
  P-->>U: redirect to /login?next=... (page) or 401 (api)
  U->>A: submit password
  A->>A: compare to APP_PASSWORD in constant time
  A-->>U: set signed session cookie
  U->>P: follow next
  P-->>U: the page
```

## Save a diagram

Runs on every `onChange`, debounced 1.5 seconds, while the editor is open.
The presigned pair comes with the scene at open and is reused until it is close to expiring, so a save is one PUT and one PATCH.

```mermaid
sequenceDiagram
  participant U as User
  participant E as Editor (client)
  participant API as GET /api/diagrams/[id]/urls
  participant S3 as S3 scenes bucket
  participant P as PATCH /api/diagrams/[id]
  U->>E: draws or edits
  E->>E: debounce 1.5s, then compare with the last saved scene
  opt no cached URL, or it expires within a minute
    E->>API: request the presigned pair
    API-->>E: GET and PUT URLs, 5 minutes
  end
  E->>S3: PUT scene JSON (elements, appState subset, files)
  S3-->>E: 200 OK
  E->>P: PATCH with the element count and the byte size just uploaded
  P-->>E: 200 OK, updatedAt moves and the list reorders
```

One upload runs at a time, and the editor never loses a change made during one.

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> saving: change, after the debounce
  saving --> idle: uploaded, measured and recorded
  saving --> queued: another change arrives mid upload
  saving --> failed: upload or touch failed
  queued --> saving: the upload ended, send the newer scene
  failed --> saving: the next change retries
```

Opening a diagram never saves it: the editor's first report after a mount becomes the baseline when it changes no element.
Deleting a diagram stops the saver before the DELETE is sent, so the scene object is not written back; deleting a folder stops the savers of every diagram under it the same way, before the cascade starts.
A locked diagram never enters this flow at all: the editor mounts no saver, `/urls` signs no upload, and the PATCH is refused by a condition on the item, so a browser that locked nothing is stopped too.
