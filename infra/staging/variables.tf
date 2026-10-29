variable "account_id" {
  type = string
  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "Cuenta AWS aprobada de 12 digitos."
  }
}
variable "domain" {
  type    = string
  default = "cocjant-esp.com"
}
variable "hosted_zone_id" { type = string }
variable "budget_email" { type = string }
variable "aurora_engine_version" {
  type        = string
  description = "Version Aurora PostgreSQL disponible en us-east-1; verificar compatibilidad antes del plan."
}
variable "backup_retention_days" {
  type        = number
  description = "Retencion aprobada; no se asume una politica para datos reales."
  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 35
    error_message = "Retencion entre 1 y 35 dias."
  }
}
variable "api_image_digest" {
  type = string
  validation {
    condition     = can(regex("^sha256:[a-f0-9]{64}$", var.api_image_digest))
    error_message = "Usa el digest de la imagen validada en ECR."
  }
}
variable "migration_image_digest" {
  type = string
  validation {
    condition     = can(regex("^sha256:[a-f0-9]{64}$", var.migration_image_digest))
    error_message = "Usa el digest del ejecutor de migraciones validado."
  }
}
variable "github_repository" {
  type    = string
  default = "jhon0210/cocantreports"
}
variable "github_oidc_provider_arn" {
  type        = string
  description = "Proveedor OIDC existente de token.actions.githubusercontent.com; revisar antes de crear duplicados."
}
