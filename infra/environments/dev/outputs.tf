output "deploy_role_arn" {
  description = "Role the deploy workflow assumes over OIDC. Terraform writes it into the environment's AWS_ROLE_ARN."
  value       = module.app.deploy_role_arn
}

output "lambda_function_name" {
  description = "Server function the deploy workflow updates the code of. Terraform writes it into the environment's LAMBDA_FUNCTION_NAME."
  value       = module.app.lambda_function_name
}

output "assets_bucket" {
  description = "Bucket the deploy workflow syncs the build output to. Terraform writes it into the environment's ASSETS_BUCKET."
  value       = module.app.assets_bucket
}

output "cloudfront_distribution_id" {
  description = "Distribution the deploy workflow invalidates. Terraform writes it into the environment's CLOUDFRONT_DISTRIBUTION_ID."
  value       = module.app.cloudfront_distribution_id
}

output "diagrams_table" {
  description = "DynamoDB table, also the DIAGRAMS_TABLE of a local .env.local"
  value       = module.app.diagrams_table
}

output "scenes_bucket" {
  description = "Scenes bucket, also the SCENES_BUCKET of a local .env.local"
  value       = module.app.scenes_bucket
}

output "url" {
  description = "Public URL of the environment"
  value       = module.app.url
}
