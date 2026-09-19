variable "github_app_pem" {
  description = "Private key of the GitHub App Terraform manages this repository's GitHub side as. The App is installed only on this repository; `infra/docs/setup.md` section 2 lists the repository permissions it needs, and an apply that answers 403 is almost always one of them missing."
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
