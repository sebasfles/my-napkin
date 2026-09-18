---
updated: 2026-09-17
source: 0001_repo_base
---

# app: flows

Neither flow is built yet; the shell has no persistence and no auth.

## Login

Runs when a request has no valid session cookie and the route is not `/login` or `/api/login`.

```mermaid
stateDiagram-v2
  [*] --> Anonymous
  Anonymous --> LoginForm: no valid cookie, middleware redirects
  LoginForm --> Authenticated: correct password, cookie set
  LoginForm --> LoginForm: wrong password, error shown
  Authenticated --> Anonymous: cookie expires after 30 days
```

```mermaid
sequenceDiagram
  participant U as User
  participant M as Middleware
  participant A as POST /api/login
  U->>M: request any route
  M-->>U: redirect to /login (no valid cookie)
  U->>A: submit password
  A->>A: compare to APP_PASSWORD
  A-->>U: set signed session cookie, redirect to /
```

## Save a diagram

Runs on every `onChange`, debounced 1 to 2 seconds, while the editor is open.

```mermaid
sequenceDiagram
  participant U as User
  participant E as Editor (client)
  participant API as GET /api/diagrams/[id]/urls
  participant S3 as S3 scenes bucket
  participant P as PATCH /api/diagrams/[id]
  U->>E: draws or edits
  E->>E: debounce 1-2s
  E->>API: request presigned PUT URL
  API-->>E: presigned URL
  E->>S3: PUT scene JSON (elements, appState, files)
  S3-->>E: 200 OK
  E->>P: PATCH to touch updatedAt
  P-->>E: 200 OK
```
