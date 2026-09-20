resource "github_repository_ruleset" "this" {
  repository  = var.repository
  name        = "protect-${var.branch}"
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["refs/heads/${var.branch}"]
      exclude = []
    }
  }

  bypass_actors {
    actor_id    = var.bypass_actor_id
    actor_type  = var.bypass_actor_type
    bypass_mode = "always"
  }

  rules {
    deletion         = true
    non_fast_forward = true

    pull_request {
      required_approving_review_count = 0
      allowed_merge_methods           = var.allowed_merge_methods
    }

    dynamic "required_status_checks" {
      for_each = length(var.required_checks) > 0 ? [1] : []

      content {
        strict_required_status_checks_policy = false

        dynamic "required_check" {
          for_each = var.required_checks

          content {
            context = required_check.value
          }
        }
      }
    }
  }
}
