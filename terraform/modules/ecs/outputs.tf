output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "service_name" {
  value = aws_ecs_service.main.name
}

output "app_task_definition_arn" {
  value = aws_ecs_task_definition.app.arn
}

output "migration_task_definition_family" {
  value = aws_ecs_task_definition.migration.family
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.ecs.name
}
