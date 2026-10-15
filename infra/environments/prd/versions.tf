terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    bucket       = "napkin-terraform-state-372303522225"
    key          = "prd/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true

    allowed_account_ids = ["372303522225"]
  }
}
