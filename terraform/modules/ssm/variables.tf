variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "nextauth_secret" {
  type      = string
  sensitive = true
}

variable "nextauth_url" {
  type = string
}

variable "minio_access_key" {
  type      = string
  sensitive = true
}

variable "minio_secret_key" {
  type      = string
  sensitive = true
}

variable "minio_bucket_name" {
  type = string
}

variable "openai_api_key" {
  type      = string
  default   = "placeholder"
  sensitive = true
}

variable "stripe_secret_key" {
  type      = string
  default   = "placeholder"
  sensitive = true
}

variable "document_analysis_lambda_arn" {
  description = "ARN of the document analysis Lambda function"
  type        = string
}

variable "analysis_callback_secret" {
  description = "Secret key for document analysis callback API"
  type        = string
  sensitive   = true
}
