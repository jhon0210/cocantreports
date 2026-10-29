resource "aws_iam_role" "deploy" {
  name = "${local.name}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow", Action = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = var.github_oidc_provider_arn }
      Condition = { StringEquals = {
        "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:staging"
      } }
    }]
  })
}
resource "aws_iam_role_policy" "deploy" {
  role = aws_iam_role.deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = "ecr:GetAuthorizationToken", Resource = "*" },
      {
        Effect   = "Allow"
        Action   = ["ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:DescribeImages"]
        Resource = "arn:aws:ecr:us-east-1:${var.account_id}:repository/cocjant-staging-api"
      },
      {
        Effect   = "Allow"
        Action   = ["lambda:UpdateFunctionCode", "lambda:GetFunctionConfiguration", "lambda:GetFunction", "lambda:PublishVersion"]
        Resource = [aws_lambda_function.api.arn, aws_lambda_function.migrate.arn, aws_lambda_function.cleanup.arn]
      },
      { Effect = "Allow", Action = ["lambda:GetAlias", "lambda:UpdateAlias"], Resource = "${aws_lambda_function.api.arn}:live" },
      { Effect = "Allow", Action = "lambda:InvokeFunction", Resource = aws_lambda_function.migrate.arn },
      { Effect = "Allow", Action = "lambda:InvokeFunction", Resource = "${aws_lambda_function.api.arn}:*" },
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = "${aws_s3_bucket.frontend.arn}/*" },
      { Effect = "Allow", Action = "s3:ListBucket", Resource = aws_s3_bucket.frontend.arn },
      { Effect = "Allow", Action = "cloudfront:CreateInvalidation", Resource = aws_cloudfront_distribution.frontend.arn }
    ]
  })
}
