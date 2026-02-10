# =============================================================================
# Environment Layer - Per-environment resources (staging / production)
# =============================================================================

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# --- Remote State (shared layer) ---
data "terraform_remote_state" "shared" {
  backend = "s3"
  config = {
    bucket = "metalk-terraform-state"
    key    = "shared/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

# --- Security Groups (ECS + RDS) ---
module "security_groups" {
  source = "../modules/security-groups"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = data.terraform_remote_state.shared.outputs.vpc_id

  create_alb_sg         = false
  create_ecs_sg         = true
  create_rds_sg         = true
  alb_security_group_id = data.terraform_remote_state.shared.outputs.alb_security_group_id
}

# --- ALB Target Group + Listener Rule ---
module "alb" {
  source = "../modules/alb"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = data.terraform_remote_state.shared.outputs.vpc_id
  public_subnet_ids     = data.terraform_remote_state.shared.outputs.public_subnet_ids
  alb_security_group_id = data.terraform_remote_state.shared.outputs.alb_security_group_id

  create_alb          = false
  alb_arn             = data.terraform_remote_state.shared.outputs.alb_arn
  listener_arn        = data.terraform_remote_state.shared.outputs.listener_arn
  create_target_group = true
  host_header         = var.host_header
}

# --- RDS ---
module "rds" {
  source = "../modules/rds"

  project_name          = var.project_name
  environment           = var.environment
  db_subnet_group_name  = data.terraform_remote_state.shared.outputs.db_subnet_group_name
  rds_security_group_id = module.security_groups.rds_security_group_id
  skip_final_snapshot   = var.rds_skip_final_snapshot
}

# --- S3 ---
module "s3" {
  source = "../modules/s3"

  project_name = var.project_name
  environment  = var.environment
}

# --- IAM (ECS roles + S3 access user) ---
module "iam" {
  source = "../modules/iam"

  project_name         = var.project_name
  environment          = var.environment
  create_github_oidc   = false
  s3_bucket_arn        = module.s3.bucket_arn
  ssm_parameter_prefix = "/metalk/${var.environment}"
}

# --- SSM Parameter Store ---
resource "random_password" "nextauth_secret" {
  length  = 64
  special = true
}

module "ssm" {
  source = "../modules/ssm"

  project_name    = var.project_name
  environment     = var.environment
  database_url    = module.rds.database_url
  nextauth_secret = random_password.nextauth_secret.result
  nextauth_url    = var.nextauth_url
  minio_access_key = module.iam.s3_access_key_id
  minio_secret_key = module.iam.s3_secret_access_key
  minio_bucket_name = module.s3.bucket_name
  openai_api_key    = var.openai_api_key
  stripe_secret_key = var.stripe_secret_key
}

# --- ECS ---
module "ecs" {
  source = "../modules/ecs"

  project_name               = var.project_name
  environment                = var.environment
  ecr_repository_url         = data.terraform_remote_state.shared.outputs.ecr_repository_url
  ecs_task_execution_role_arn = module.iam.ecs_task_execution_role_arn
  ecs_task_role_arn           = module.iam.ecs_task_role_arn
  public_subnet_ids          = data.terraform_remote_state.shared.outputs.public_subnet_ids
  ecs_security_group_id      = module.security_groups.ecs_security_group_id
  target_group_arn           = module.alb.target_group_arn
}

# --- CloudFront ---
module "cloudfront" {
  source = "../modules/cloudfront"

  project_name = var.project_name
  environment  = var.environment
  alb_dns_name = data.terraform_remote_state.shared.outputs.alb_dns_name
  host_header  = var.host_header
}
