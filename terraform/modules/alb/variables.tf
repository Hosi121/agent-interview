variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g. staging, production)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "public_subnet_ids" {
  description = "IDs of the public subnets for the ALB"
  type        = list(string)
  default     = []
}

variable "alb_security_group_id" {
  description = "Security group ID for the ALB"
  type        = string
  default     = ""
}

variable "create_alb" {
  description = "Whether to create the ALB and HTTP listener"
  type        = bool
  default     = true
}

variable "alb_arn" {
  description = "Existing ALB ARN when create_alb is false"
  type        = string
  default     = ""
}

variable "listener_arn" {
  description = "Existing listener ARN when create_alb is false"
  type        = string
  default     = ""
}

variable "create_target_group" {
  description = "Whether to create a target group and listener rule"
  type        = bool
  default     = false
}

variable "host_header" {
  description = "Host header value for the listener rule condition"
  type        = string
  default     = ""
}

variable "health_check_path" {
  description = "Path for the target group health check"
  type        = string
  default     = "/api/health"
}
