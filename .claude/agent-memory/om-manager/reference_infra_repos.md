---
name: reference-infra-repos
description: auvral-infra and diy-infra are the Terraform convention to copy for my-napkin's infra/ folder
metadata:
  type: reference
---

Sebastian's Terraform convention lives in two repos he asked to use as reference for `infra/`:
- `/home/fless/dev/personal/projects/auvral/auvral-infra` (personal)
- `/home/fless/dev/designli/projects/diy/diy-infra` (Designli)

Shared shape: `environments/{core,dev,...}` as independent roots (S3 backend, `use_lockfile`, key `{env}/terraform.tfstate`), `stacks/{backend,frontend}` composites, `modules/aws/<service>` leaf modules with main/outputs/variables/versions.
`.env.example` exports `AWS_PROFILE`; `terraform.tfvars.example` committed, real tfvars and `.env` gitignored; tfvars holds only what cannot be committed, everything else literal in `locals.tf`.
Naming `local.name_prefix = "${project}-${env}"`, tags `merge(local.tags, { Name = ... })`, buckets append account id.
Terraform owns config, the workflow owns code: Lambda module points at a bootstrap S3 key and `ignore_changes = [s3_key, s3_object_version, source_code_hash, publish]`.
OIDC provider in `core/oidc.tf`; deploy roles per consumer with the two sub shapes (`repo:owner/repo:ref` and `repo:owner@*/repo@*:ref`).
CLAUDE.md sections: What this repo is, Structure, Naming conventions, Key patterns, Things that look wrong and are not, Working with an environment, What Terraform does NOT manage.
diy-infra ships `.claude/hooks/block-read.js` (PreToolUse) that blocks agents from reading `*.tfvars` and private pem files.

**How to apply:** when setup or a task writes `infra/`, point the om-reviewer at these paths as the reference; my-napkin is single env so it is a scaled-down copy, not the full tree.
