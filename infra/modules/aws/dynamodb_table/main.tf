resource "aws_dynamodb_table" "this" {
  name                        = var.name
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = var.hash_key
  deletion_protection_enabled = var.deletion_protection

  dynamic "attribute" {
    for_each = var.attributes

    content {
      name = attribute.key
      type = attribute.value
    }
  }

  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }

  tags = { Name = var.name }
}
