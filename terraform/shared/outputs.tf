# --- Networking ---
output "vpc_id" {
  value = module.networking.vpc_id
}

output "public_subnet_ids" {
  value = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  value = module.networking.private_subnet_ids
}

output "db_subnet_group_name" {
  value = module.networking.db_subnet_group_name
}

# --- Security Groups ---
output "alb_security_group_id" {
  value = module.security_groups.alb_security_group_id
}

# --- ALB ---
output "alb_arn" {
  value = module.alb.alb_arn
}

output "alb_dns_name" {
  value = module.alb.alb_dns_name
}

output "listener_arn" {
  value = module.alb.listener_arn
}

# --- ECR ---
output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "ecr_repository_name" {
  value = module.ecr.repository_name
}

# --- IAM ---
output "github_actions_role_arn" {
  value = module.iam.github_actions_role_arn
}
