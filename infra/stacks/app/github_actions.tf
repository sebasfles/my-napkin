data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "assume_github" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # GitHub emits two subject shapes: a repository that has ever been renamed
    # or transferred gets owner and repository ids welded into the subject, and
    # a future transfer moves this repository into that shape without warning.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_owner}/${var.github_repository}:ref:refs/heads/${var.git_branch}",
        "repo:${var.github_owner}@*/${var.github_repository}@*:ref:refs/heads/${var.git_branch}",
      ]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${local.name_prefix}-deploy"
  assume_role_policy = data.aws_iam_policy_document.assume_github.json

  tags = { Name = "${local.name_prefix}-deploy" }
}

resource "aws_iam_role_policy" "deploy" {
  name = "deploy"
  role = aws_iam_role.deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "UpdateFunction"
        Effect   = "Allow"
        Action   = ["lambda:UpdateFunctionCode", "lambda:GetFunction"]
        Resource = module.server.arn
      },
      {
        Sid      = "ListAssets"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = module.assets_bucket.arn
      },
      {
        Sid      = "SyncAssets"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "${module.assets_bucket.arn}/*"
      },
      {
        Sid      = "Invalidate"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = module.cdn.distribution_arn
      },
    ]
  })
}
