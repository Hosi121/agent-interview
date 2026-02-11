data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name_prefix   = "${var.project_name}-${var.environment}"
  function_name = "${local.name_prefix}-document-analysis"
  account_id    = data.aws_caller_identity.current.account_id
  region        = data.aws_region.current.name

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

################################################################################
# ECR Repository
################################################################################

resource "aws_ecr_repository" "lambda" {
  name                 = "${var.project_name}-lambda-document-analysis"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-lambda-document-analysis"
  })
}

resource "aws_ecr_lifecycle_policy" "lambda" {
  repository = aws_ecr_repository.lambda.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

################################################################################
# CloudWatch Log Group
################################################################################

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 30
  tags              = local.common_tags
}

################################################################################
# IAM Role
################################################################################

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_execution" {
  name               = "${local.name_prefix}-lambda-execution"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-lambda-execution"
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_s3" {
  statement {
    sid = "S3ReadAccess"
    actions = [
      "s3:GetObject",
      "s3:ListBucket",
    ]
    resources = [
      var.s3_bucket_arn,
      "${var.s3_bucket_arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "lambda_s3" {
  name   = "${local.name_prefix}-lambda-s3"
  role   = aws_iam_role.lambda_execution.id
  policy = data.aws_iam_policy_document.lambda_s3.json
}

################################################################################
# Lambda Function
################################################################################

resource "aws_lambda_function" "document_analysis" {
  function_name = local.function_name
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.lambda.repository_url}:latest"
  role          = aws_iam_role.lambda_execution.arn
  timeout       = 900
  memory_size   = 2048

  environment {
    variables = {
      STORAGE_PROVIDER  = "s3"
      MINIO_ACCESS_KEY  = var.minio_access_key
      MINIO_SECRET_KEY  = var.minio_secret_key
      MINIO_BUCKET_NAME = var.minio_bucket_name
      OPENAI_API_KEY    = var.openai_api_key
      CALLBACK_URL      = var.callback_url
      CALLBACK_SECRET   = var.callback_secret
    }
  }

  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [aws_cloudwatch_log_group.lambda]

  tags = local.common_tags
}
