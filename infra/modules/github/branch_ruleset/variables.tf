variable "repository" {
  description = "Repository the ruleset belongs to"
  type        = string
}

variable "branch" {
  description = "Branch the ruleset protects. One ruleset per branch, because the required checks differ per branch."
  type        = string
}

variable "required_checks" {
  description = "Status checks a pull request must pass before it can merge. A check that no workflow produces yet blocks every merge except the bypass actor's."
  type        = list(string)
  default     = []
}

variable "allowed_merge_methods" {
  description = "Merge methods the pull request rule allows"
  type        = list(string)
  default     = ["merge"]
}

variable "bypass_actor_type" {
  description = "Kind of actor allowed to bypass the ruleset. RepositoryRole is the only one that matches anybody in a user-owned repository; OrganizationAdmin matches nobody there."
  type        = string
  default     = "RepositoryRole"
}

variable "bypass_actor_id" {
  description = "Actor allowed to bypass the ruleset. Within RepositoryRole, 5 is the repository admin."
  type        = number
  default     = 5
}
