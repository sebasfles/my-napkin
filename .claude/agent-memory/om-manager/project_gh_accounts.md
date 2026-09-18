---
name: gh-accounts-on-this-machine
description: gh is globally active as sflores-designli; my-napkin needs the sebasfles account via GH_TOKEN, never gh auth switch
metadata:
  type: project
---

`gh` on this machine is active as `sflores-designli` (Designli projects depend on it); `sebasfles` is added as a second account for `sebasfles/my-napkin`.

**Why:** `gh auth switch` is global and would break the reviewers of local-auctions, diy and other Designli projects running at the same time.
**How to apply:** every gh call on this repo, mine or a reviewer's, runs with `GH_TOKEN=$(gh auth token -u sebasfles)` in its environment; put that rule in every om-reviewer launch prompt. Git push already works through the ssh alias `personal-github`.
