module "diagrams_table" {
  source = "../../modules/aws/dynamodb_table"

  name       = "${local.name_prefix}-diagrams"
  hash_key   = "id"
  attributes = { id = "S" }

  point_in_time_recovery = var.point_in_time_recovery
  deletion_protection    = var.deletion_protection
}
