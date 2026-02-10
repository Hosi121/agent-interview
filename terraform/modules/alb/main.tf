locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

################################################################################
# Application Load Balancer
################################################################################

resource "aws_lb" "main" {
  count = var.create_alb ? 1 : 0

  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb"
  })
}

################################################################################
# HTTP Listener (default: 404)
################################################################################

resource "aws_lb_listener" "http" {
  count = var.create_alb ? 1 : 0

  load_balancer_arn = aws_lb.main[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }

  tags = local.common_tags
}

################################################################################
# Target Group
################################################################################

resource "aws_lb_target_group" "main" {
  count = var.create_target_group ? 1 : 0

  name        = "${local.name_prefix}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = var.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-tg"
  })
}

################################################################################
# Listener Rule (host-based routing)
################################################################################

resource "aws_lb_listener_rule" "host" {
  count = var.create_target_group ? 1 : 0

  listener_arn = var.create_alb ? aws_lb_listener.http[0].arn : var.listener_arn

  condition {
    host_header {
      values = [var.host_header]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main[0].arn
  }

  tags = local.common_tags
}
