---
name: project-aws-context
description: my-napkin AWS account, profile, hosted zone and domain decided on 2026-09-17, until docs/TRD.md records them
metadata:
  type: project
---

AWS profile `personal` (account 975050033628, IAM user sebastian.flores, no default region).
Route53 hosted zone `sdfles.com` (Z07789852332B51WUS33Z) already exists in that account with other records (deepcover, mailing, DKIM).
App domain: `napkin.sdfles.com`. Origin: Lambda Function URL. GitHub repo `sebasfles/my-napkin` over SSH host `personal-github`.

**Why:** Sebastian wants everything in one personal account and $0 fixed cost.
**How to apply:** Terraform reads the zone with `data "aws_route53_zone"` and only owns the `napkin` records; never import the zone. Once `docs/TRD.md` exists this memory is redundant, delete it.
