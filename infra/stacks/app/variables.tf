variable "env" {
  description = "Environment name, part of every resource name"
  type        = string
}

variable "base_domain" {
  description = "Domain the application's hostname hangs from. The application answers on napkin.{base_domain}."
  type        = string
}

variable "hosted_zone" {
  description = "Route53 zone that answers for the hostname. It is read, never owned, and it is not always base_domain: dev.sdfles.com has no zone of its own."
  type        = string
}

variable "github_owner" {
  description = "Owner of the repository the deploy role trusts"
  type        = string
}

variable "github_repository" {
  description = "Repository the deploy role trusts"
  type        = string
}

variable "git_branch" {
  description = "The only branch whose workflow runs may enter this environment's Actions environment, and through it assume the deploy role"
  type        = string
}

variable "extra_cors_origins" {
  description = "Origins besides the application's own that may read and write scenes from a browser"
  type        = list(string)
  default     = []
}

variable "point_in_time_recovery" {
  description = "Whether the diagrams table keeps continuous backups"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Whether the diagrams table refuses to be deleted"
  type        = bool
  default     = false
}

variable "force_destroy" {
  description = "Whether Terraform may delete buckets that still hold objects"
  type        = bool
  default     = false
}

variable "scene_version_retention_days" {
  description = "Days a superseded scene version is kept before S3 expires it"
  type        = number
  default     = 30
}

variable "static_path_patterns" {
  description = "Paths CloudFront serves from the assets bucket. The application has no public/ directory, so the build output holds nothing but _next/static."
  type        = list(string)
  default     = ["/_next/static/*"]
}

variable "lambda_memory_size" {
  description = "Memory of the server function, in MB"
  type        = number
  default     = 1024
}

variable "lambda_timeout" {
  description = "Timeout of the server function, in seconds"
  type        = number
  default     = 30
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention of the server function"
  type        = number
  default     = 14
}

variable "app_password" {
  description = "Password the login form compares against"
  type        = string
  sensitive   = true
}

variable "session_secret" {
  description = "HMAC key the session cookie is signed with"
  type        = string
  sensitive   = true
}
