output "deploy_role_arn" {
  description = "Value of the AWS_ROLE_ARN Actions variable of this environment"
  value       = module.app.deploy_role_arn
}

output "lambda_function_name" {
  description = "Value of the LAMBDA_FUNCTION_NAME Actions variable of this environment"
  value       = module.app.lambda_function_name
}

output "assets_bucket" {
  description = "Value of the ASSETS_BUCKET Actions variable of this environment"
  value       = module.app.assets_bucket
}

output "cloudfront_distribution_id" {
  description = "Value of the CLOUDFRONT_DISTRIBUTION_ID Actions variable of this environment"
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
