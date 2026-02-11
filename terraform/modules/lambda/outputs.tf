output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.document_analysis.arn
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.document_analysis.function_name
}

output "lambda_ecr_repository_url" {
  description = "URL of the Lambda ECR repository"
  value       = aws_ecr_repository.lambda.repository_url
}

output "lambda_ecr_repository_arn" {
  description = "ARN of the Lambda ECR repository"
  value       = aws_ecr_repository.lambda.arn
}
