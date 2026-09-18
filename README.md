# my-napkin

my-napkin is a personal, single-user whiteboard hosted on AWS at `napkin.sdfles.com`.
It wraps the Excalidraw editor in a small Next.js app that adds a list of named diagrams which persist between sessions and devices, behind a single password.
The interface is available in Spanish and English and follows the system light or dark theme, and the whole thing is designed to run at $0 fixed cost per month inside the AWS free tier.

## Credit

The editor is [Excalidraw](https://github.com/excalidraw/excalidraw), used unmodified through the [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) npm package and licensed under the MIT license.
This project only provides the shell around it: the diagram list, persistence and access control.

## Running it locally

Requires Node 24 (see `.nvmrc`).
Every command runs inside `app/`.

```bash
nvm use
cd app
npm ci
npm run dev
```

The editor is then served at `http://localhost:3000`.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint and Prettier |
| `npm run typecheck` | TypeScript, no emit |
| `npx vitest run` | Unit tests |
| `npx playwright test --workers=1 --grep-invert @aws` | End-to-end tests |
| `npx open-next build` | AWS build artifact, into `.open-next/` |

## Documentation

`docs/TRD.md` describes the stack and the commands, `docs/PRD.md` what the product does, and `docs/ARD.md` the architecture decisions and the open debt.
Per-module documentation lives under `docs/modules/`.
