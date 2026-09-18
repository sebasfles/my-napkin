---
updated: 2026-09-18
source: 0005_password_auth
---

# app: flows

Login is built; saving is not, since the shell has no persistence yet.

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
