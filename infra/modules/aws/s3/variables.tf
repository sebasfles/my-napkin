variable "name" {
  description = "Bucket name"
  type        = string
}

variable "versioning_enabled" {
  description = "Whether to keep object versions"
  type        = bool
  default     = false
}

variable "force_destroy" {
  description = "Allow Terraform to delete a bucket that still holds objects"
  type        = bool
  default     = false
}

variable "cors_allowed_origins" {
  description = "Origins allowed to read the bucket from a browser. Empty means no CORS rule."
  type        = list(string)
  default     = []
}

variable "cors_allowed_methods" {
  description = "Methods the CORS rule allows. Only read when cors_allowed_origins is not empty."
  type        = list(string)
  default     = ["GET", "HEAD"]
}

variable "lifecycle_rules" {
  description = "Lifecycle rules keyed by rule id. Each rule may expire current versions, noncurrent versions, or both; a null field leaves that expiration out of the rule."
  type = map(object({
    prefix                                 = optional(string, "")
    expiration_days                        = optional(number)
    noncurrent_version_expiration_days     = optional(number)
    abort_incomplete_multipart_upload_days = optional(number)
  }))
  default = {}
}

variable "cloudfront_read" {
  description = "Whether the bucket policy grants read access to a CloudFront distribution and to nobody else. Separate from cloudfront_distribution_arn because the ARN is unknown until the distribution is created and count must be known at plan time."
  type        = bool
  default     = false
}

variable "cloudfront_distribution_arn" {
  description = "Distribution allowed to read the bucket through its origin access control. Only read when cloudfront_read is true."
  type        = string
  default     = null
}
