output "alb_arn" {
  description = "ARN of the ALB"
  value       = try(aws_lb.main[0].arn, var.alb_arn)
}

output "alb_dns_name" {
  description = "DNS name of the ALB"
  value       = try(aws_lb.main[0].dns_name, "")
}

output "listener_arn" {
  description = "ARN of the HTTP listener"
  value       = try(aws_lb_listener.http[0].arn, var.listener_arn)
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = try(aws_lb_target_group.main[0].arn, "")
}
