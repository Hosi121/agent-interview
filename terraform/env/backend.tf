terraform {
  backend "s3" {
    bucket         = "metalk-terraform-state"
    region         = "ap-northeast-1"
    dynamodb_table = "metalk-terraform-lock"
    encrypt        = true
    # key is set via -backend-config="key={environment}/terraform.tfstate"
  }
}
