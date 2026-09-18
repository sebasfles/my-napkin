---
updated: 2026-09-17
source: setup
---

# app: technical

No code exists yet. This describes the planned design, stated as planned.

## Structure (planned)

| Path | What |
|---|---|
| `app/src/app/page.tsx` | Diagram list plus editor, client component |
| `app/src/app/login/page.tsx` | Password form |
| `app/src/app/api/diagrams/route.ts` | GET list, POST create |
| `app/src/app/api/diagrams/[id]/route.ts` | PATCH rename, DELETE |
| `app/src/app/api/diagrams/[id]/urls/route.ts` | GET presigned URLs for the scene |
| `app/src/app/api/login/route.ts` | POST login |
| `app/src/middleware.ts` | Session cookie check, redirects to `/login` |
| `app/src/components/` | Excalidraw wrapper, loaded via `next/dynamic` with `ssr: false` |

## Endpoints owned

| Method | Route | Purpose | Spec |
|---|---|---|---|
| GET | `/api/diagrams` | List diagrams, Scan on DynamoDB | none |
| POST | `/api/diagrams` | Create diagram id and name in DynamoDB | none |
| PATCH | `/api/diagrams/[id]` | Rename, or touch `updatedAt` after a scene PUT | none |
| DELETE | `/api/diagrams/[id]` | Delete in DynamoDB and S3 | none |
| GET | `/api/diagrams/[id]/urls` | Presigned GET and PUT URLs for the scene | none |
| POST | `/api/login` | Validate `APP_PASSWORD`, set signed session cookie | none |

Jobs, listeners or scheduled work: none.

## Depends on

- DynamoDB table (diagram index): read and write through the AWS SDK.
- S3 scenes bucket: presigned URLs generated server-side, PUT/GET performed by the browser directly.
- `@excalidraw/excalidraw` npm package: the editor component.

## Depended on by

- `deploy` (`.github/workflows/`): builds this module with OpenNext and updates the Lambda.
- `infra` (`infra/`): provisions the env vars this module reads.

## Configuration

- `APP_PASSWORD`: password compared in `/api/login`.
- `SESSION_SECRET`: HMAC key used to sign the session cookie.
- Table name and scenes bucket name: passed by Terraform as Lambda env vars.

## Testing

- Tests live in `app/tests/`.
- Lint: `npm run lint`.
- Typecheck: `npm run typecheck`.
- Unit: `npx vitest run`.
- E2E: `npx playwright test --workers=1`.
- Install: `npm ci`.
- Workspace file: `.env.local`.
