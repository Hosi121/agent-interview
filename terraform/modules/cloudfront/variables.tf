variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g. staging, production)"
  type        = string
}

variable "alb_dns_name" {
  description = "DNS name of the ALB to use as CloudFront origin"
  type        = string
}

variable "host_header" {
  description = "Host header value to forward to the ALB origin"
  type        = string
}
