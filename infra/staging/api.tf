resource "aws_iam_role" "runtime" {
  for_each = toset(["api", "migrate", "cleanup"])
  name     = "${local.name}-${each.key}"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}
resource "aws_iam_role_policy_attachment" "vpc" {
  for_each   = aws_iam_role.runtime
  role       = each.value.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}
resource "aws_iam_role_policy" "secret" {
  for_each = aws_iam_role.runtime
  role     = each.value.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "secretsmanager:GetSecretValue", Resource = each.key == "migrate" ? aws_secretsmanager_secret.migration.arn : aws_secretsmanager_secret.application.arn }]
  })
}
resource "aws_iam_role_policy" "files" {
  for_each = toset(["api", "cleanup"])
  role     = aws_iam_role.runtime[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = ["${aws_s3_bucket.files.arn}/pendientes/*", "${aws_s3_bucket.files.arn}/archivos/*"] },
      { Effect = "Allow", Action = "s3:DeleteObject", Resource = ["${aws_s3_bucket.files.arn}/pendientes/*", "${aws_s3_bucket.files.arn}/archivos/*"] }
    ]
  })
}
resource "aws_lambda_function" "cleanup" {
  function_name                  = "${local.name}-cleanup"
  role                           = aws_iam_role.runtime["cleanup"].arn
  package_type                   = "Image"
  image_uri                      = "${local.repository}@${var.api_image_digest}"
  architectures                  = ["x86_64"]
  memory_size                    = 512
  timeout                        = 120
  reserved_concurrent_executions = 1
  image_config { command = ["dist/cleanup-files.handler"] }
  environment {
    variables = {
      NODE_ENV     = "production", APP_SECRET_ARN = aws_secretsmanager_secret.application.arn
      FILE_STORAGE = "s3", S3_FILES_BUCKET = aws_s3_bucket.files.id
    }
  }
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }
  depends_on = [aws_iam_role_policy_attachment.vpc, aws_iam_role_policy.secret, aws_cloudwatch_log_group.lambda]
  lifecycle { ignore_changes = [image_uri] }
}
resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = aws_iam_role.runtime
  name              = "/aws/lambda/${local.name}-${each.key}"
  retention_in_days = 14
}
resource "aws_lambda_function" "api" {
  function_name                  = "${local.name}-api"
  role                           = aws_iam_role.runtime["api"].arn
  package_type                   = "Image"
  image_uri                      = "${local.repository}@${var.api_image_digest}"
  architectures                  = ["x86_64"]
  memory_size                    = 1024
  timeout                        = 28
  reserved_concurrent_executions = 2
  publish                        = true
  environment {
    variables = {
      NODE_ENV     = "production", APP_SECRET_ARN = aws_secretsmanager_secret.application.arn
      FILE_STORAGE = "s3", S3_FILES_BUCKET = aws_s3_bucket.files.id
      CORS_ORIGINS = "https://${local.app_host}", COOKIE_SECURE = "true", COOKIE_SAMESITE = "strict"
    }
  }
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }
  depends_on = [aws_iam_role_policy_attachment.vpc, aws_iam_role_policy.secret, aws_cloudwatch_log_group.lambda]
  lifecycle { ignore_changes = [image_uri] }
}
resource "aws_lambda_alias" "live" {
  name             = "live"
  function_name    = aws_lambda_function.api.function_name
  function_version = aws_lambda_function.api.version
  lifecycle { ignore_changes = [function_version] }
}
resource "aws_lambda_function" "migrate" {
  function_name                  = "${local.name}-migrate"
  role                           = aws_iam_role.runtime["migrate"].arn
  package_type                   = "Image"
  image_uri                      = "${local.repository}@${var.migration_image_digest}"
  architectures                  = ["x86_64"]
  memory_size                    = 1024
  timeout                        = 900
  reserved_concurrent_executions = 1
  environment {
    variables = { NODE_ENV = "production", APP_SECRET_ARN = aws_secretsmanager_secret.migration.arn }
  }
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }
  depends_on = [aws_iam_role_policy_attachment.vpc, aws_iam_role_policy.secret, aws_cloudwatch_log_group.lambda]
  lifecycle { ignore_changes = [image_uri] }
}
resource "aws_apigatewayv2_api" "main" {
  name                         = local.name
  protocol_type                = "HTTP"
  disable_execute_api_endpoint = true
}
resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_alias.live.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}
resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.gateway.arn
    format = jsonencode({
      requestId = "$context.requestId", status = "$context.status", responseLength = "$context.responseLength"
    })
  }
  default_route_settings {
    throttling_burst_limit = 10
    throttling_rate_limit  = 5
  }
  resource "aws_cloudwatch_log_group" "gateway" {
    name              = "/aws/apigateway/${local.name}"
    retention_in_days = 14
  }
}
resource "aws_lambda_permission" "api" {
  statement_id  = "ApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  qualifier     = aws_lambda_alias.live.name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
resource "aws_apigatewayv2_domain_name" "main" {
  domain_name = local.api_host
  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.site.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}
resource "aws_apigatewayv2_api_mapping" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.main.id
  stage       = aws_apigatewayv2_stage.main.id
}
resource "aws_route53_record" "api" {
  zone_id = var.hosted_zone_id
  name    = local.api_host
  type    = "A"
  alias {
    name                   = aws_apigatewayv2_domain_name.main.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.main.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
