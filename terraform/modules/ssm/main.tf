locals {
  name_prefix = "${var.project_name}-${var.environment}"
  prefix      = "/${var.project_name}/${var.environment}"
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_ssm_parameter" "database_url" {
  name  = "${local.prefix}/database-url"
  type  = "SecureString"
  value = var.database_url
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "nextauth_secret" {
  name  = "${local.prefix}/nextauth-secret"
  type  = "SecureString"
  value = var.nextauth_secret
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "nextauth_url" {
  name  = "${local.prefix}/nextauth-url"
  type  = "String"
  value = var.nextauth_url
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "storage_provider" {
  name  = "${local.prefix}/storage-provider"
  type  = "String"
  value = "s3"
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "minio_access_key" {
  name  = "${local.prefix}/minio-access-key"
  type  = "SecureString"
  value = var.minio_access_key
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "minio_secret_key" {
  name  = "${local.prefix}/minio-secret-key"
  type  = "SecureString"
  value = var.minio_secret_key
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "minio_bucket_name" {
  name  = "${local.prefix}/minio-bucket-name"
  type  = "String"
  value = var.minio_bucket_name
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "aws_region" {
  name  = "${local.prefix}/aws-region"
  type  = "String"
  value = "ap-northeast-1"
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "openai_api_key" {
  name  = "${local.prefix}/openai-api-key"
  type  = "SecureString"
  value = var.openai_api_key
  tags  = local.common_tags

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "stripe_secret_key" {
  name  = "${local.prefix}/stripe-secret-key"
  type  = "SecureString"
  value = var.stripe_secret_key
  tags  = local.common_tags

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "document_analysis_lambda_arn" {
  name  = "${local.prefix}/document-analysis-lambda-arn"
  type  = "String"
  value = var.document_analysis_lambda_arn
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "analysis_callback_secret" {
  name  = "${local.prefix}/analysis-callback-secret"
  type  = "SecureString"
  value = var.analysis_callback_secret
  tags  = local.common_tags
}
