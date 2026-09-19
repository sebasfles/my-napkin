module "assets_bucket" {
  source = "../../modules/aws/s3"

  name          = "${local.name_prefix}-assets-${data.aws_caller_identity.current.account_id}"
  force_destroy = var.force_destroy

  cloudfront_read             = true
  cloudfront_distribution_arn = module.cdn.distribution_arn
}

module "scenes_bucket" {
  source = "../../modules/aws/s3"

  name               = "${local.name_prefix}-scenes-${data.aws_caller_identity.current.account_id}"
  force_destroy      = var.force_destroy
  versioning_enabled = true

  cors_allowed_origins = local.scenes_cors_origins
  cors_allowed_methods = ["GET", "PUT", "HEAD"]

  lifecycle_rules = {
    expire-old-scene-versions = {
      prefix                                 = "scenes/"
      noncurrent_version_expiration_days     = var.scene_version_retention_days
      abort_incomplete_multipart_upload_days = 7
    }
  }
}
