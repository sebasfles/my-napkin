variable "github_app_pem" {
  description = "Private key of the GitHub App Terraform manages the rulesets as. The App is installed only on this repository, with Administration read and write and Metadata read."
  type        = string
  sensitive   = true
}

variable "budget_notification_email" {
  description = "Address the monthly budget alert is sent to. A variable and not a literal because the repository is public."
  type        = string
  sensitive   = true
}
