output "distribution_id" {
  description = "ID of the distribution, used to create invalidations"
  value       = aws_cloudfront_distribution.this.id
}

output "distribution_arn" {
  description = "ARN of the distribution, used by the origin bucket policy and the Function URL permission"
  value       = aws_cloudfront_distribution.this.arn
}

output "url" {
  description = "HTTPS URL the distribution answers on"
  value       = "https://${var.domain}"
}
