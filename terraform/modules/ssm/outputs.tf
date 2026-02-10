output "parameter_arns" {
  value = [
    aws_ssm_parameter.database_url.arn,
    aws_ssm_parameter.nextauth_secret.arn,
    aws_ssm_parameter.nextauth_url.arn,
    aws_ssm_parameter.storage_provider.arn,
    aws_ssm_parameter.minio_access_key.arn,
    aws_ssm_parameter.minio_secret_key.arn,
    aws_ssm_parameter.minio_bucket_name.arn,
    aws_ssm_parameter.aws_region.arn,
    aws_ssm_parameter.openai_api_key.arn,
    aws_ssm_parameter.stripe_secret_key.arn,
  ]
}

output "parameter_prefix" {
  value = local.prefix
}
