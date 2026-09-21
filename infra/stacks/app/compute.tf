locals {
  scenes_bucket_prefixes = ["scenes", "libraries"]
}

module "server" {
  source = "../../modules/aws/lambda_function"

  name               = "${local.name_prefix}-server"
  memory_size        = var.lambda_memory_size
  timeout            = var.lambda_timeout
  log_retention_days = var.log_retention_days
  function_url       = true

  environment = {
    APP_PASSWORD   = var.app_password
    SESSION_SECRET = var.session_secret
    DIAGRAMS_TABLE = module.diagrams_table.name
    SCENES_BUCKET  = module.scenes_bucket.id
  }

  policy_statements = {
    diagrams = {
      actions = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
      ]
      resources = [module.diagrams_table.arn]
    }

    scenes = {
      actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
      resources = [for prefix in local.scenes_bucket_prefixes : "${module.scenes_bucket.arn}/${prefix}/*"]
    }
  }
}
