resource "github_repository_environment" "this" {
  repository  = var.repository
  environment = var.environment

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_repository_environment_deployment_policy" "this" {
  repository     = var.repository
  environment    = github_repository_environment.this.environment
  branch_pattern = var.deployment_branch
}

resource "github_actions_environment_variable" "this" {
  for_each = var.env_vars

  repository    = var.repository
  environment   = github_repository_environment.this.environment
  variable_name = each.key
  value         = each.value
}

resource "github_actions_environment_secret" "this" {
  for_each = nonsensitive(toset(keys(var.env_secrets)))

  repository  = var.repository
  environment = github_repository_environment.this.environment
  secret_name = each.key
  value       = var.env_secrets[each.key]
}
