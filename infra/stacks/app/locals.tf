data "aws_caller_identity" "current" {}

data "aws_route53_zone" "this" {
  name         = "${var.hosted_zone}."
  private_zone = false
}

locals {
  name_prefix = "napkin-${var.env}"
  domain      = "napkin.${var.base_domain}"

  scenes_cors_origins = concat(["https://${local.domain}"], var.extra_cors_origins)
}
