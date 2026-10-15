locals {
  ### General ##################################################################
  project        = "my-napkin"
  env            = "core"
  aws_region     = "us-east-1"
  aws_account_id = "372303522225"
  name_prefix    = "napkin-${local.env}"

  ### GitHub ###################################################################
  github_owner               = "sebasfles"
  github_repository          = "my-napkin"
  github_app_id              = "4985607"
  github_app_installation_id = "162648841"

  tags = {
    Project     = local.project
    Environment = local.env
    ManagedBy   = "terraform"
  }
}
