locals {
  name_prefix = var.environment != "" ? "${var.project_name}-${var.environment}" : var.project_name

  common_tags = merge(
    {
      Project   = var.project_name
      ManagedBy = "terraform"
    },
    var.environment != "" ? { Environment = var.environment } : {}
  )

  effective_alb_sg_id = var.create_alb_sg ? aws_security_group.alb[0].id : var.alb_security_group_id
}

################################################################################
# ALB Security Group
################################################################################

resource "aws_security_group" "alb" {
  count = var.create_alb_sg ? 1 : 0

  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for ALB"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  count = var.create_alb_sg ? 1 : 0

  security_group_id = aws_security_group.alb[0].id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  count = var.create_alb_sg ? 1 : 0

  security_group_id = aws_security_group.alb[0].id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_all" {
  count = var.create_alb_sg ? 1 : 0

  security_group_id = aws_security_group.alb[0].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

################################################################################
# ECS Security Group
################################################################################

resource "aws_security_group" "ecs" {
  count = var.create_ecs_sg ? 1 : 0

  name        = "${local.name_prefix}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  count = var.create_ecs_sg ? 1 : 0

  security_group_id            = aws_security_group.ecs[0].id
  referenced_security_group_id = local.effective_alb_sg_id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "ecs_all" {
  count = var.create_ecs_sg ? 1 : 0

  security_group_id = aws_security_group.ecs[0].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

################################################################################
# RDS Security Group
################################################################################

resource "aws_security_group" "rds" {
  count = var.create_rds_sg ? 1 : 0

  name        = "${local.name_prefix}-rds-sg"
  description = "Security group for RDS"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  count = (var.create_rds_sg && var.create_ecs_sg) ? 1 : 0

  security_group_id            = aws_security_group.rds[0].id
  referenced_security_group_id = aws_security_group.ecs[0].id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "rds_to_ecs" {
  count = (var.create_rds_sg && var.create_ecs_sg) ? 1 : 0

  security_group_id            = aws_security_group.rds[0].id
  referenced_security_group_id = aws_security_group.ecs[0].id
  ip_protocol                  = "-1"
}
