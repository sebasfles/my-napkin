variable "repository" {
  description = "Repository the environment belongs to. The name alone, not owner/name."
  type        = string
}

variable "environment" {
  description = "Name of the Actions environment. A workflow job reaches its variables and secrets by naming it in `environment:`."
  type        = string
}

variable "deployment_branch" {
  description = "The only branch whose jobs may reference the environment. A job from any other branch, or from a fork, fails before it runs, so an OIDC role that trusts this environment is reachable from this branch alone."
  type        = string
}

variable "env_vars" {
  description = "Plain variables of the environment, readable by anyone who can read the repository"
  type        = map(string)
  default     = {}
}

variable "env_secrets" {
  description = "Secrets of the environment, write-only once set"
  type        = map(string)
  sensitive   = true
  default     = {}
}
