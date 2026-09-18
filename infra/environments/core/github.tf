locals {
  # Both checks belong to workflows that do not exist yet. Until they do, the
  # bypass actor is the only way to merge anything.
  protected_branches = {
    develop = ["ci"]
    main    = ["ci", "e2e-dev"]
  }
}

module "branch_ruleset" {
  source   = "../../modules/github/branch_ruleset"
  for_each = local.protected_branches

  repository      = local.github_repository
  branch          = each.key
  required_checks = each.value
}
