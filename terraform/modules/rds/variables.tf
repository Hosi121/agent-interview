variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "db_subnet_group_name" {
  type = string
}

variable "rds_security_group_id" {
  type = string
}

variable "skip_final_snapshot" {
  type        = bool
  default     = true
  description = "Skip final snapshot on destroy. Set to false for production."
}
