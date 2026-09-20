locals {
  protected_branches = {
    develop = ["ci"]
    main    = ["ci", "e2e-dev"]
  }
}

resource "github_workflow_repository_permissions" "this" {
  repository                       = local.github_repository
  default_workflow_permissions     = "read"
  can_approve_pull_request_reviews = true
}

module "branch_ruleset" {
  source   = "../../modules/github/branch_ruleset"
  for_each = local.protected_branches

  repository      = local.github_repository
  branch          = each.key
  required_checks = each.value
}
