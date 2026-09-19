locals {
  ### General ##################################################################
  project    = "my-napkin"
  env        = "prd"
  aws_region = "us-east-1"

  ### DNS ######################################################################
  base_domain = "sdfles.com"
  hosted_zone = "sdfles.com"

  ### GitHub ###################################################################
  github_owner               = "sebasfles"
  github_repository          = "my-napkin"
  github_app_id              = "4985607"
  github_app_installation_id = "162648841"
  git_branch                 = "main"

  ### Environment differences ##################################################
  extra_cors_origins     = []
  point_in_time_recovery = true
  deletion_protection    = true
  force_destroy          = false

  tags = {
    Project     = local.project
    Environment = local.env
    ManagedBy   = "terraform"
  }
}
