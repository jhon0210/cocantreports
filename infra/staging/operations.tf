resource "aws_sns_topic" "alerts" { name = "${local.name}-alerts" }
resource "aws_cloudwatch_event_rule" "cleanup" {
  name                = "${local.name}-cleanup"
  schedule_expression = "rate(1 day)"
  state               = "DISABLED"
}
resource "aws_cloudwatch_event_target" "cleanup" {
  rule  = aws_cloudwatch_event_rule.cleanup.name
  arn   = aws_lambda_function.cleanup.arn
  input = jsonencode({ operation = "cleanup-files" })
  retry_policy {
    maximum_event_age_in_seconds = 3600
    maximum_retry_attempts       = 2
  }
}
resource "aws_lambda_permission" "cleanup" {
  statement_id  = "ScheduledCleanup"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cleanup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cleanup.arn
}
resource "aws_sns_topic_subscription" "alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.budget_email
}
resource "aws_cloudwatch_log_group" "database" {
  name              = "/aws/rds/cluster/${local.name}/postgresql"
  retention_in_days = 14
}
resource "aws_cloudwatch_metric_alarm" "errors" {
  alarm_name          = "${local.name}-api-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = aws_lambda_function.api.function_name }
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
resource "aws_cloudwatch_metric_alarm" "database" {
  alarm_name          = "${local.name}-database-capacity"
  namespace           = "AWS/RDS"
  metric_name         = "ACUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 90
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { DBInstanceIdentifier = aws_rds_cluster_instance.writer.id }
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
resource "aws_budgets_budget" "staging" {
  name         = local.name
  budget_type  = "COST"
  limit_amount = "80"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  cost_filter {
    name   = "TagKeyValue"
    values = ["Environment$staging"]
  }
  dynamic "notification" {
    for_each = [50, 80, 100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.budget_email]
    }
  }
}
output "frontend_url" { value = "https://${local.app_host}" }
output "api_url" { value = "https://${local.api_host}" }
output "database_endpoint" { value = aws_rds_cluster.main.endpoint }
output "application_secret_arn" { value = aws_secretsmanager_secret.application.arn }
output "migration_secret_arn" { value = aws_secretsmanager_secret.migration.arn }
output "database_admin_secret_arn" { value = aws_rds_cluster.main.master_user_secret[0].secret_arn }
output "frontend_bucket" { value = aws_s3_bucket.frontend.id }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.frontend.id }
output "deploy_role_arn" { value = aws_iam_role.deploy.arn }
