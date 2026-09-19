locals {
  ### General ##################################################################
  project    = "my-napkin"
  env        = "dev"
  aws_region = "us-east-1"

  ### DNS ######################################################################
  base_domain = "dev.sdfles.com"
  hosted_zone = "sdfles.com"

  ### GitHub ###################################################################
  github_owner      = "sebasfles"
  github_repository = "my-napkin"
  git_branch        = "develop"

  ### Environment differences ##################################################
  extra_cors_origins     = ["http://localhost:3000"]
  point_in_time_recovery = false
  deletion_protection    = false
  force_destroy          = true

  tags = {
    Project     = local.project
    Environment = local.env
    ManagedBy   = "terraform"
  }
}
