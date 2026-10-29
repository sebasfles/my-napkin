---
name: gh-accounts-on-this-machine
description: gh has several accounts on this machine and the active one changes; my-napkin always uses GH_TOKEN=$(gh auth token -u sebasfles), never gh auth switch, and reviewers need that rule in their launch prompt
metadata:
  type: project
---

`gh` on this machine holds several accounts (the work account, `auvral-development`, `sebasfles`); the active one changes by hand and other projects' sessions depend on it. `sebasfles` is the one for `sebasfles/my-napkin`. Active since 2026-09-20 night: `sebasfles`, switched by Sebastian for 0016's PR.

**Why:** `gh auth switch` is global and breaks the reviewers of whatever project relies on the other account; the classifier also denies it to reviewers (Credential Exploration), so a reviewer without the rule ends blocked at `gh pr create`.
**How to apply:** every gh call on this repo, mine or a reviewer's, runs with `GH_TOKEN=$(gh auth token -u sebasfles)`; put that rule in every om-reviewer launch prompt and pass it explicitly when Sebastian authorizes it. Git push already works through the ssh alias `personal-github`. Also `.claude/settings.local.json` does not reach worktrees, so per-task permission rules must be checked at consolidation.
