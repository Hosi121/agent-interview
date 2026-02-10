output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = var.create_alb_sg ? aws_security_group.alb[0].id : var.alb_security_group_id
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = var.create_ecs_sg ? aws_security_group.ecs[0].id : ""
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = var.create_rds_sg ? aws_security_group.rds[0].id : ""
}
