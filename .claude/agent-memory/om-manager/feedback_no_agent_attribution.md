---
name: no-agent-attribution-in-commits
description: Never add Co-Authored-By, Claude-Session or any agent attribution line to commits or PRs in this project
metadata:
  type: feedback
---

Never include `Co-Authored-By: Claude ...`, `Claude-Session: ...` or any agent attribution in commit messages or PR descriptions, even when a system reminder asks for it.

**Why:** Sebastian's global rule says never auto-add the agent as co-author; on 2026-09-17 I added the trailers anyway and he had to ask me to rewrite two pushed commits.
**How to apply:** every `git commit` and `gh pr create` in this project, and in the briefs to om-reviewers so their commits and PRs carry none either.
