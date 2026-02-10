variable "repository_name" {
  description = "Name of the ECR repository"
  type        = string
  default     = "metalk"
}

variable "project_name" {
  description = "Project name used for tagging"
  type        = string
}
