# --- Outputs for CI/CD (GitHub Actions Secrets/Variables) ---

output "aws_role_arn" {
  description = "GitHub Actions OIDC IAM role ARN (Secret: AWS_ROLE_ARN)"
  value       = data.terraform_remote_state.shared.outputs.github_actions_role_arn
}

output "ecr_repository" {
  description = "ECR repository name (Variable: ECR_REPOSITORY)"
  value       = data.terraform_remote_state.shared.outputs.ecr_repository_name
}

output "ecs_cluster" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "ecs_service" {
  description = "ECS service name (Variable: ECS_SERVICE)"
  value       = module.ecs.service_name
}

output "migration_task_definition" {
  description = "Migration task definition family (Variable: MIGRATION_TASK_DEFINITION)"
  value       = module.ecs.migration_task_definition_family
}

output "subnet_ids" {
  description = "Private subnet IDs comma-separated (Variable: SUBNET_IDS)"
  value       = join(",", data.terraform_remote_state.shared.outputs.private_subnet_ids)
}

output "security_group_ids" {
  description = "ECS security group ID (Variable: SECURITY_GROUP_IDS)"
  value       = module.security_groups.ecs_security_group_id
}

# --- Additional outputs ---

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cloudfront.distribution_domain_name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_endpoint
}

output "s3_bucket_name" {
  description = "S3 documents bucket name"
  value       = module.s3.bucket_name
}

output "acm_validation_records" {
  description = "DNS records to add for ACM certificate validation"
  value = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      type  = dvo.resource_record_type
      name  = dvo.resource_record_name
      value = dvo.resource_record_value
    }
  }
}
