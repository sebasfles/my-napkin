output "deploy_role_arn" {
  description = "Role the deploy workflow assumes over OIDC"
  value       = aws_iam_role.deploy.arn
}

output "lambda_function_name" {
  description = "Server function the deploy workflow updates the code of"
  value       = module.server.name
}

output "assets_bucket" {
  description = "Bucket the deploy workflow syncs the static build output to"
  value       = module.assets_bucket.id
}

output "cloudfront_distribution_id" {
  description = "Distribution the deploy workflow invalidates"
  value       = module.cdn.distribution_id
}

output "diagrams_table" {
  description = "DynamoDB table holding the diagram index"
  value       = module.diagrams_table.name
}

output "scenes_bucket" {
  description = "Bucket holding the scene bodies"
  value       = module.scenes_bucket.id
}

output "url" {
  description = "Public URL of the environment"
  value       = module.cdn.url
}
