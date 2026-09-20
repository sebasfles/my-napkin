module "certificate" {
  source = "../../modules/aws/acm"

  domain_name = local.domain
  zone_id     = data.aws_route53_zone.this.zone_id
}

module "cdn" {
  source = "../../modules/aws/cloudfront"

  name            = "${local.name_prefix}-cdn"
  domain          = local.domain
  zone_id         = data.aws_route53_zone.this.zone_id
  certificate_arn = module.certificate.certificate_arn

  assets_origin_domain_name = module.assets_bucket.regional_domain_name
  server_origin_domain_name = module.server.url_domain
  static_path_patterns      = var.static_path_patterns
}

resource "aws_lambda_permission" "cdn" {
  statement_id           = "AllowCloudFrontInvokeFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = module.server.name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = module.cdn.distribution_arn
  function_url_auth_type = "AWS_IAM"
}

resource "aws_lambda_permission" "cdn_invoke" {
  statement_id  = "AllowCloudFrontInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = module.server.name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = module.cdn.distribution_arn
}
