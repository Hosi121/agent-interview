variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g. staging, production)"
  type        = string
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 bucket for document storage"
  type        = string
}

variable "callback_url" {
  description = "Callback URL for analysis results"
  type        = string
}

variable "callback_secret" {
  description = "Secret key for callback authentication"
  type        = string
  sensitive   = true
}

variable "minio_access_key" {
  description = "S3 access key for MinIO SDK"
  type        = string
  sensitive   = true
}

variable "minio_secret_key" {
  description = "S3 secret key for MinIO SDK"
  type        = string
  sensitive   = true
}

variable "minio_bucket_name" {
  description = "S3 bucket name"
  type        = string
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
}
