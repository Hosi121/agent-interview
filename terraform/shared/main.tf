# =============================================================================
# Shared Layer - Resources shared across all environments
# =============================================================================

# --- Networking ---
module "networking" {
  source       = "../modules/networking"
  project_name = var.project_name
}

# --- ALB Security Group ---
module "security_groups" {
  source       = "../modules/security-groups"
  project_name = var.project_name
  environment  = "shared"
  vpc_id       = module.networking.vpc_id

  create_alb_sg = true
  create_ecs_sg = false
  create_rds_sg = false
}

# --- ALB ---
module "alb" {
  source = "../modules/alb"

  project_name          = var.project_name
  environment           = "shared"
  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  alb_security_group_id = module.security_groups.alb_security_group_id

  create_alb          = true
  create_target_group = false
}

# --- ECR ---
module "ecr" {
  source       = "../modules/ecr"
  project_name = var.project_name
}

# --- IAM (GitHub OIDC) ---
module "iam" {
  source = "../modules/iam"

  project_name         = var.project_name
  environment          = "shared"
  create_github_oidc   = true
  create_ecs_roles     = false
  github_repository    = var.github_repository
  ecr_repository_arn   = module.ecr.repository_arn
  ssm_parameter_prefix = "/metalk"
}
