variable "github_app_pem" {
  description = "Private key of the GitHub App Terraform manages this repository's GitHub side as. The App is installed only on this repository; `infra/docs/setup.md` section 2 lists the repository permissions it needs, and an apply that answers 403 is almost always one of them missing."
  type        = string
  sensitive   = true
}
