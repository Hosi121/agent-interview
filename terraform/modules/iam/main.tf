data "aws_caller_identity" "current" {}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  account_id  = data.aws_caller_identity.current.account_id

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

################################################################################
# ECS Task Execution Role
################################################################################

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  count = var.create_ecs_roles ? 1 : 0

  name               = "${local.name_prefix}-ecs-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-task-execution"
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  count = var.create_ecs_roles ? 1 : 0

  role       = aws_iam_role.ecs_task_execution[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "ecs_task_execution_custom" {
  count = var.create_ecs_roles ? 1 : 0

  statement {
    sid = "SSMGetParameters"
    actions = [
      "ssm:GetParameters",
      "ssm:GetParameter",
      "ssm:GetParametersByPath",
    ]
    resources = [
      "arn:aws:ssm:ap-northeast-1:${local.account_id}:parameter${var.ssm_parameter_prefix}/*",
    ]
  }

  statement {
    sid = "SecretsManager"
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    resources = [
      "arn:aws:secretsmanager:ap-northeast-1:${local.account_id}:secret:${var.ssm_parameter_prefix}/*",
    ]
  }

  statement {
    sid = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "arn:aws:logs:ap-northeast-1:${local.account_id}:log-group:/ecs/${var.project_name}-*",
      "arn:aws:logs:ap-northeast-1:${local.account_id}:log-group:/ecs/${var.project_name}-*:*",
    ]
  }
}

resource "aws_iam_role_policy" "ecs_task_execution_custom" {
  count = var.create_ecs_roles ? 1 : 0

  name   = "${local.name_prefix}-ecs-task-execution-custom"
  role   = aws_iam_role.ecs_task_execution[0].id
  policy = data.aws_iam_policy_document.ecs_task_execution_custom[0].json
}

################################################################################
# ECS Task Role
################################################################################

resource "aws_iam_role" "ecs_task" {
  count = var.create_ecs_roles ? 1 : 0

  name               = "${local.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-task"
  })
}

data "aws_iam_policy_document" "ecs_task_s3" {
  count = (var.create_ecs_roles && var.create_s3_access) ? 1 : 0

  statement {
    sid = "S3Access"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    resources = [
      var.s3_bucket_arn,
      "${var.s3_bucket_arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  count = (var.create_ecs_roles && var.create_s3_access) ? 1 : 0

  name   = "${local.name_prefix}-ecs-task-s3"
  role   = aws_iam_role.ecs_task[0].id
  policy = data.aws_iam_policy_document.ecs_task_s3[0].json
}


################################################################################
# S3 Access IAM User (for MinIO SDK)
################################################################################

resource "aws_iam_user" "s3_access" {
  count = var.create_s3_access ? 1 : 0

  name = "${local.name_prefix}-s3-access"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-s3-access"
  })
}

resource "aws_iam_access_key" "s3_access" {
  count = var.create_s3_access ? 1 : 0

  user = aws_iam_user.s3_access[0].name
}

data "aws_iam_policy_document" "s3_access_user" {
  count = var.create_s3_access ? 1 : 0

  statement {
    sid = "S3BucketAccess"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    resources = [
      var.s3_bucket_arn,
      "${var.s3_bucket_arn}/*",
    ]
  }
}

resource "aws_iam_user_policy" "s3_access" {
  count = var.create_s3_access ? 1 : 0

  name   = "${local.name_prefix}-s3-access"
  user   = aws_iam_user.s3_access[0].name
  policy = data.aws_iam_policy_document.s3_access_user[0].json
}
