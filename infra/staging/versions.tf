terraform {
  required_version = "~> 1.13.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
  backend "s3" {
    key          = "staging/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region              = "us-east-1"
  allowed_account_ids = [var.account_id]
  default_tags { tags = { Project = "cocjant", Environment = "staging", ManagedBy = "Terraform" } }
}
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" { state = "available" }
locals {
  name       = "cocjant-staging"
  app_host   = "staging.${var.domain}"
  api_host   = "api-staging.${var.domain}"
  repository = "${var.account_id}.dkr.ecr.us-east-1.amazonaws.com/cocjant-staging-api"
}
