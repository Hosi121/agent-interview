output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = try(aws_iam_role.ecs_task_execution[0].arn, "")
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = try(aws_iam_role.ecs_task[0].arn, "")
}

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions IAM role"
  value       = try(aws_iam_role.github_actions[0].arn, "")
}

output "s3_access_key_id" {
  description = "Access key ID for the S3 access IAM user"
  value       = try(aws_iam_access_key.s3_access[0].id, "")
}

output "s3_secret_access_key" {
  description = "Secret access key for the S3 access IAM user"
  value       = try(aws_iam_access_key.s3_access[0].secret, "")
  sensitive   = true
}

output "ecs_task_role_id" {
  description = "ID of the ECS task role"
  value       = try(aws_iam_role.ecs_task[0].id, "")
}
