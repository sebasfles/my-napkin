# my-napkin

A personal, single-user Excalidraw hosted on AWS at `napkin.sdfles.com`, with a list of persistent diagrams.

## Where things are

- `app/`: the Next.js application (editor, diagram list, API routes, auth).
- `infra/`: Terraform for the AWS resources, applied by hand.
- `.github/workflows/`: CI on pull requests and deploy on `main`.
- Product, technical and architecture docs live in `docs/`. Start with `docs/TRD.md` for stack and commands, `docs/PRD.md` for what the product does, `docs/ARD.md` for decisions and debt.
- Each module has its own folder in `docs/modules/{{module}}/` with `README.md`, `prd.md`, `trd.md`, `ard.md`, `database.md` and optionally `flows.md`.
- Tasks live in `docs/tasks/`; drafts in `docs/tasks/_drafts/` are not tracked.

## Read before working

1. This file.
2. `docs/TRD.md` and `docs/PRD.md`.
3. Only the module you are about to touch.

## Rules

- Base branch: `main`.
- Run tests one at a time; see the Verification section of `docs/TRD.md`.
- Never read or edit `*.tfvars` or `.env` files; only their `.example` twins. A hook in `.claude/hooks/block-read.js` enforces it.
- The repo is public: no secret, state file or account-specific credential is ever committed.
- Terraform owns configuration, GitHub Actions owns code. Never deploy application code from Terraform and never change infrastructure from a workflow.
- The word `excalidraw` never appears in repo, domain or AWS resource names, only in the README credit and the npm dependency.
