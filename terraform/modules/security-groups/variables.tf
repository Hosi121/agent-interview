variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., staging, production). Empty string for shared resources."
  type        = string
  default     = ""
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "create_alb_sg" {
  description = "Whether to create the ALB security group"
  type        = bool
  default     = true
}

variable "create_ecs_sg" {
  description = "Whether to create the ECS security group"
  type        = bool
  default     = true
}

variable "create_rds_sg" {
  description = "Whether to create the RDS security group"
  type        = bool
  default     = true
}

variable "alb_security_group_id" {
  description = "Existing ALB security group ID. Used when create_alb_sg is false."
  type        = string
  default     = ""
}
