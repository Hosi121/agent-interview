################################################################################
# GitHub OIDC Provider
################################################################################

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-github-oidc"
  })
}

################################################################################
# GitHub Actions IAM Role
################################################################################

data "aws_iam_policy_document" "github_actions_assume" {
  count = var.create_github_oidc ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github[0].arn]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:ref:refs/heads/*"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  count = var.create_github_oidc ? 1 : 0

  name               = "${local.name_prefix}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume[0].json

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-github-actions"
  })
}

data "aws_iam_policy_document" "github_actions" {
  count = var.create_github_oidc ? 1 : 0

  statement {
    sid = "ECRAuth"
    actions = [
      "ecr:GetAuthorizationToken",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ECRPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = [var.ecr_repository_arn]
  }

  statement {
    sid = "ECSReadOnly"
    actions = [
      "ecs:DescribeTasks",
      "ecs:DescribeServices",
      "ecs:DescribeTaskDefinition",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ECSRegisterTaskDefinition"
    actions = [
      "ecs:RegisterTaskDefinition",
    ]
    resources = ["*"] # RegisterTaskDefinition does not support resource-level permissions
  }

  statement {
    sid = "ECSMutate"
    actions = [
      "ecs:RunTask",
      "ecs:UpdateService",
    ]
    resources = [
      "arn:aws:ecs:ap-northeast-1:${local.account_id}:cluster/${var.project_name}-*",
      "arn:aws:ecs:ap-northeast-1:${local.account_id}:service/${var.project_name}-*/*",
      "arn:aws:ecs:ap-northeast-1:${local.account_id}:task-definition/${var.project_name}-*:*",
      "arn:aws:ecs:ap-northeast-1:${local.account_id}:task/${var.project_name}-*/*",
    ]
  }

  statement {
    sid = "IAMPassRole"
    actions = [
      "iam:PassRole",
    ]
    resources = [
      "arn:aws:iam::${local.account_id}:role/${var.project_name}-*-ecs-task*",
    ]
  }

  statement {
    sid = "CloudWatchLogs"
    actions = [
      "logs:GetLogEvents",
      "logs:DescribeLogStreams",
      "logs:DescribeLogGroups",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions" {
  count = var.create_github_oidc ? 1 : 0

  name   = "${local.name_prefix}-github-actions"
  role   = aws_iam_role.github_actions[0].id
  policy = data.aws_iam_policy_document.github_actions[0].json
}
