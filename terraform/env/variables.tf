variable "project_name" {
  type    = string
  default = "metalk"
}

variable "environment" {
  type        = string
  description = "Environment name (staging or production)"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "host_header" {
  type        = string
  description = "Host header for ALB listener rule (e.g., staging.metalk.example.com)"
}

variable "nextauth_url" {
  type        = string
  description = "NEXTAUTH_URL for the environment"
}

variable "openai_api_key" {
  type        = string
  default     = "placeholder"
  sensitive   = true
  description = "OpenAI API key (update manually in SSM after apply)"
}

variable "stripe_secret_key" {
  type        = string
  default     = "placeholder"
  sensitive   = true
  description = "Stripe secret key (update manually in SSM after apply)"
}

variable "rds_skip_final_snapshot" {
  type        = bool
  default     = true
  description = "Skip final snapshot on RDS destroy. Set to false for production."
}
