# My Napkin

My Napkin is a personal, single-user whiteboard hosted on AWS at `napkin.sdfles.com`.
It wraps the Excalidraw editor in a small Next.js app that adds a list of named diagrams, in folders and tabs, which persist between sessions and devices behind a single password.
The interface speaks Spanish and English, follows the system light or dark theme, and the whole thing is designed to run at $0 fixed cost per month inside the AWS free tier.

## Stack

Next.js (App Router) and TypeScript on Node 24, Tailwind with shadcn/ui, `next-intl` and `next-themes`, `@excalidraw/excalidraw` from npm.
DynamoDB holds the diagram index and S3 the scenes, which the browser reads and writes directly through presigned URLs, so no drawing ever passes through the server.
It is built with OpenNext into one Lambda plus static assets, and every AWS resource is Terraform in `infra/`.

## Credit

The editor is [Excalidraw](https://github.com/excalidraw/excalidraw), used unmodified through the [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) npm package and licensed under the MIT license.
This project only provides the shell around it: the diagram list, persistence and access control.

## Running it locally

Requires Node 24 (see `.nvmrc`) and an `app/.env.local`, which is gitignored.
Copy it from `app/.env.example` and fill it: the password and the session secret are yours to choose, the table and the bucket come from `terraform output` in `infra/environments/dev`.
Local development talks to the real dev table and bucket, so an AWS profile with access to them is needed too.

```bash
nvm use
cd app
cp .env.example .env.local
npm ci
npm run dev
```

The editor is then served at `http://localhost:3000`, and every command below runs inside `app/`.

| Command                           | What it does                           |
| --------------------------------- | -------------------------------------- |
| `npm run dev`                     | Development server                     |
| `npm run build`                   | Production build                       |
| `npm run lint`                    | ESLint and Prettier                    |
| `npm run typecheck`               | TypeScript, no emit                    |
| `npx vitest run`                  | Unit tests                             |
| `npx playwright test --workers=1` | End-to-end tests, against dev          |
| `npx open-next build`             | AWS build artifact, into `.open-next/` |

## Environments and how a change ships

There are two environments in the same AWS account: `dev` at `napkin.dev.sdfles.com`, built from `develop`, and `prd` at `napkin.sdfles.com`, built from `main`.

Every change arrives by pull request into `develop`, gated by one `ci` check.
Merging it deploys dev, runs the full Playwright suite against that deployment, and opens the pull request `develop -> main`, which carries that run as the proof the change works deployed; merging it deploys production.
Nothing is deployed by hand, and no browser test ever runs against production.

## Documentation

`docs/TRD.md` describes the stack and the commands, `docs/PRD.md` what the product does, and `docs/ARD.md` the architecture decisions and the open debt.
Per-module documentation lives under `docs/modules/`.
