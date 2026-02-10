terraform {
  backend "s3" {
    bucket       = "metalk-terraform-state"
    region       = "ap-northeast-1"
    use_lockfile = true
    encrypt      = true
    profile      = "metalk"
    # key is set via -backend-config="key=shared/terraform.tfstate"
  }
}
