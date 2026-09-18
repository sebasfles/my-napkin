module "app" {
  source = "../../stacks/app"

  env         = local.env
  base_domain = local.base_domain
  hosted_zone = local.hosted_zone

  github_owner      = local.github_owner
  github_repository = local.github_repository
  git_branch        = local.git_branch

  extra_cors_origins     = local.extra_cors_origins
  point_in_time_recovery = local.point_in_time_recovery
  deletion_protection    = local.deletion_protection
  force_destroy          = local.force_destroy

  app_password   = var.app_password
  session_secret = var.session_secret
}
