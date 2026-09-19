output "github_oidc_provider_arn" {
  description = "OIDC provider every environment's deploy role federates with"
  value       = aws_iam_openid_connect_provider.github.arn
}

output "ruleset_ids" {
  description = "Ruleset protecting each branch"
  value       = { for branch, ruleset in module.branch_ruleset : branch => ruleset.ruleset_id }
}
