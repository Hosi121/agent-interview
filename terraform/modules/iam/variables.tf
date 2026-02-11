variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g. staging, production)"
  type        = string
}

variable "create_github_oidc" {
  description = "Whether to create GitHub OIDC provider and Actions role"
  type        = bool
  default     = false
}

variable "github_repository" {
  description = "GitHub repository in format owner/repo"
  type        = string
  default     = "Hosi121/agent-interview"
}

variable "create_ecs_roles" {
  description = "Whether to create ECS task execution and task roles"
  type        = bool
  default     = true
}

variable "create_s3_access" {
  description = "Whether to create S3 access resources (ECS task policy + IAM user)"
  type        = bool
  default     = false
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 bucket for ECS task and user access"
  type        = string
  default     = ""
}

variable "ssm_parameter_prefix" {
  description = "SSM Parameter Store prefix (e.g. /metalk/staging)"
  type        = string
}

variable "ecr_repository_arn" {
  description = "ARN of the ECR repository for GitHub Actions push access"
  type        = string
  default     = ""
}

variable "lambda_ecr_repository_arn" {
  description = "ARN of the Lambda ECR repository for GitHub Actions push access"
  type        = string
  default     = ""
}

variable "lambda_function_arn" {
  description = "ARN of the Lambda function for GitHub Actions update permission"
  type        = string
  default     = ""
}

