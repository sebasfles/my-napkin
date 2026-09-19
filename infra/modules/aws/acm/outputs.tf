output "certificate_arn" {
  description = "ARN of the validated certificate. Reading it waits for validation to finish."
  value       = aws_acm_certificate_validation.this.certificate_arn
}
