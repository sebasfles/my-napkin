variable "name" {
  description = "Table name"
  type        = string
}

variable "hash_key" {
  description = "Partition key attribute name"
  type        = string
}

variable "attributes" {
  description = "Attribute definitions, keyed by name, with the DynamoDB type (S, N or B). Only key attributes belong here; DynamoDB is schemaless for the rest."
  type        = map(string)
}

variable "point_in_time_recovery" {
  description = "Whether to keep continuous backups"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Whether the table refuses to be deleted, by Terraform or by anything else"
  type        = bool
  default     = false
}
