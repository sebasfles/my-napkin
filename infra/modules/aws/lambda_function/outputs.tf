output "name" {
  description = "Function name"
  value       = aws_lambda_function.this.function_name
}

output "arn" {
  description = "Function ARN"
  value       = aws_lambda_function.this.arn
}

output "role_arn" {
  description = "ARN of the function's execution role"
  value       = aws_iam_role.this.arn
}

output "url" {
  description = "Function URL, null when function_url is false"
  value       = var.function_url ? aws_lambda_function_url.this[0].function_url : null
}

output "url_domain" {
  description = "Host of the Function URL, which is what a CloudFront origin takes"
  value       = var.function_url ? trimsuffix(trimprefix(aws_lambda_function_url.this[0].function_url, "https://"), "/") : null
}
