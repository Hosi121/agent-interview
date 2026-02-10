# Infrastructure

## Architecture

```
                    ┌─────────────┐
                    │ CloudFront  │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │     ALB     │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │    Public Subnets       │
              │  ┌───────────────────┐  │
              │  │   ECS Fargate     │  │
              │  │  (0.25vCPU/1GB)   │  │
              │  └───────────────────┘  │
              └────────────┬────────────┘
                           │
              ┌────────────┴────────────┐
              │   Private Subnets       │
              │  ┌───────────────────┐  │
              │  │  RDS PostgreSQL   │  │
              │  └───────────────────┘  │
              └─────────────────────────┘

              ┌─────────────────────────┐
              │          S3             │
              │  (Document Storage)     │
              └─────────────────────────┘
```

## Components

| Component | Spec | Notes |
|-----------|------|-------|
| ECS Fargate | 0.25 vCPU / 1 GB, 1 task | Public Subnets, ALB target |
| RDS PostgreSQL | db.t4g.micro, 20GB gp3 | Private Subnets, Single-AZ |
| S3 | Standard | Document storage (MinIO SDK compatible) |
| ALB | Application Load Balancer | Health check: `/api/health` |
| CloudFront | Distribution | ALB origin, caching static assets |

## Cost Breakdown (Monthly)

| Resource | Cost |
|----------|------|
| ECS Fargate (0.25vCPU/1GB) | ~$9 |
| RDS db.t4g.micro | ~$15 |
| ALB | ~$18 |
| S3 | ~$1 |
| CloudFront | ~$1 |
| Other (ECR, CloudWatch, etc.) | ~$10 |
| **Total** | **~$54** |

NAT Gateway なし構成により月額 ~$35 を節約。

## Environment Separation

| | Staging | Production |
|--|---------|------------|
| Branch | `develop` | `main` |
| ECS Cluster | `metalk-staging` | `metalk-production` |
| ECS Service | Separate | Separate |
| ALB | Shared | Shared (ホストベースルーティングで振り分け) |
| RDS | Separate instance | Separate instance |
| S3 Bucket | Separate | Separate |
| ECR | Shared | Shared (タグで分離) |
| Image tag | `staging-latest` | `production-latest` |

## Deploy Flow

1. Push to `develop` or `main`
2. GitHub Actions: lint, type check, test (with PostgreSQL service container)
3. Docker build → ECR push (tag: `{sha}` + `{env}-latest`)
4. ECS one-off task: `prisma migrate deploy`
5. ECS service update: `--force-new-deployment`

## Notes

### NAT Gateway なし構成

ECS タスクは Public Subnets に配置し `assignPublicIp=ENABLED` で外部通信（OpenAI API, Stripe API 等）を行う。NAT Gateway ($35/月) を節約できるが、ECS タスクにパブリック IP が割り当てられる点に留意。

### Prisma Migration Strategy

GitHub Actions から RDS への直接接続は不可（Private Subnets）。マイグレーションは ECS ワンオフタスク（`prisma migrate deploy`）として実行する。マイグレーション用タスク定義のコンテナ名は `migration` とすること（`deploy.yml` の `containerOverrides` と一致させる必要がある）。

### MinIO SDK Constraint

MinIO SDK は AWS credential chain（IAM ロール等）に非対応。PMF 期は SSM Parameter Store 経由の静的 IAM キーで S3 にアクセスする。将来的に `@aws-sdk/client-s3` への移行を検討。

### pdf-to-img on Alpine

`pdf-to-img` が Alpine Linux 上で動作しない場合、Dockerfile に `apk add libc6-compat` を追加する。
