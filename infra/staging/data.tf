resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}
resource "aws_rds_cluster" "main" {
  cluster_identifier              = local.name
  engine                          = "aurora-postgresql"
  engine_mode                     = "provisioned"
  engine_version                  = var.aurora_engine_version
  database_name                   = "cocjant"
  master_username                 = "cocjant_owner"
  manage_master_user_password     = true
  db_subnet_group_name            = aws_db_subnet_group.main.name
  vpc_security_group_ids          = [aws_security_group.database.id]
  storage_encrypted               = true
  backup_retention_period         = var.backup_retention_days
  deletion_protection             = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${local.name}-final"
  copy_tags_to_snapshot           = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 1
  }
  depends_on = [aws_cloudwatch_log_group.database]
  lifecycle { prevent_destroy = true }
}
resource "aws_rds_cluster_instance" "writer" {
  identifier                 = "${local.name}-writer"
  cluster_identifier         = aws_rds_cluster.main.id
  instance_class             = "db.serverless"
  engine                     = aws_rds_cluster.main.engine
  engine_version             = aws_rds_cluster.main.engine_version
  publicly_accessible        = false
  auto_minor_version_upgrade = true
  lifecycle { prevent_destroy = true }
}
resource "aws_secretsmanager_secret" "application" {
  name                    = "${local.name}/application"
  recovery_window_in_days = 30
  lifecycle { prevent_destroy = true }
}
resource "aws_secretsmanager_secret" "migration" {
  name                    = "${local.name}/migration"
  recovery_window_in_days = 30
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket" "files" {
  bucket        = "${local.name}-files-${var.account_id}"
  force_destroy = false
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket" "frontend" {
  bucket        = "${local.name}-frontend-${var.account_id}"
  force_destroy = false
  lifecycle { prevent_destroy = true }
}
locals { buckets = { files = aws_s3_bucket.files, frontend = aws_s3_bucket.frontend } }
resource "aws_s3_bucket_public_access_block" "all" {
  for_each                = local.buckets
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_ownership_controls" "all" {
  for_each = local.buckets
  bucket   = each.value.id
  rule { object_ownership = "BucketOwnerEnforced" }
}
resource "aws_s3_bucket_versioning" "all" {
  for_each = local.buckets
  bucket   = each.value.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "all" {
  for_each = local.buckets
  bucket   = each.value.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_cors_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  cors_rule {
    allowed_origins = ["https://${local.app_host}"]
    allowed_methods = ["POST", "GET", "HEAD"]
    allowed_headers = ["Content-Type", "x-amz-*"]
    expose_headers  = ["ETag", "x-amz-checksum-sha256"]
    max_age_seconds = 300
  }
}
resource "aws_s3_bucket_lifecycle_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    id     = "temporales-abandonados"
    status = "Enabled"
    filter { prefix = "pendientes/" }
    expiration { days = 2 }
    noncurrent_version_expiration { noncurrent_days = 2 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}
resource "aws_s3_bucket_policy" "files" {
  bucket = aws_s3_bucket.files.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Deny", Principal = "*", Action = "s3:*"
      Resource  = [aws_s3_bucket.files.arn, "${aws_s3_bucket.files.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}
