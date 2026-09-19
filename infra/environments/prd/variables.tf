variable "github_app_pem" {
  description = "Private key of the GitHub App Terraform manages the Actions environment as. The App is installed only on this repository, with Administration read and write and Metadata read."
  type        = string
  sensitive   = true
}

variable "app_password" {
  description = "Password the login form compares against, injected into the server function"
  type        = string
  sensitive   = true
}

variable "session_secret" {
  description = "HMAC key the session cookie is signed with, injected into the server function"
  type        = string
  sensitive   = true
}
