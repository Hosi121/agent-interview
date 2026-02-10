locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
  ssm_prefix = "/${var.project_name}/${var.environment}"
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_ecs_cluster" "main" {
  name = local.name_prefix
  tags = local.common_tags
}

# App task definition
resource "aws_ecs_task_definition" "app" {
  family                   = "${local.name_prefix}-app"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256 # 0.25 vCPU
  memory                   = 512 # 0.5 GB
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = "${var.ecr_repository_url}:${var.environment}-latest"
      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "HOSTNAME", value = "0.0.0.0" },
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = "${local.ssm_prefix}/database-url" },
        { name = "NEXTAUTH_SECRET", valueFrom = "${local.ssm_prefix}/nextauth-secret" },
        { name = "NEXTAUTH_URL", valueFrom = "${local.ssm_prefix}/nextauth-url" },
        { name = "STORAGE_PROVIDER", valueFrom = "${local.ssm_prefix}/storage-provider" },
        { name = "MINIO_ACCESS_KEY", valueFrom = "${local.ssm_prefix}/minio-access-key" },
        { name = "MINIO_SECRET_KEY", valueFrom = "${local.ssm_prefix}/minio-secret-key" },
        { name = "MINIO_BUCKET_NAME", valueFrom = "${local.ssm_prefix}/minio-bucket-name" },
        { name = "AWS_REGION", valueFrom = "${local.ssm_prefix}/aws-region" },
        { name = "OPENAI_API_KEY", valueFrom = "${local.ssm_prefix}/openai-api-key" },
        { name = "STRIPE_SECRET_KEY", valueFrom = "${local.ssm_prefix}/stripe-secret-key" },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = "ap-northeast-1"
          "awslogs-stream-prefix" = "app"
        }
      }
    }
  ])

  tags = local.common_tags
}

# Migration task definition (same image, different command)
resource "aws_ecs_task_definition" "migration" {
  family                   = "${local.name_prefix}-migration"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "migration" # MUST match deploy.yml containerOverrides
      image     = "${var.ecr_repository_url}:${var.environment}-latest"
      essential = true

      command = ["npx", "prisma", "migrate", "deploy"]

      environment = [
        { name = "NODE_ENV", value = "production" },
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = "${local.ssm_prefix}/database-url" },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = "ap-northeast-1"
          "awslogs-stream-prefix" = "migration"
        }
      }
    }
  ])

  tags = local.common_tags
}

# ECS Service
resource "aws_ecs_service" "main" {
  name            = local.name_prefix
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = true # No NAT Gateway, needs public IP
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "app"
    container_port   = 3000
  }

  lifecycle {
    ignore_changes = [task_definition] # CI/CD updates the image
  }

  tags = local.common_tags
}
