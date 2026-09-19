variable "name" {
  description = "Name prefix for the distribution and its origin access controls"
  type        = string
}

variable "domain" {
  description = "Public domain the distribution answers on"
  type        = string
}

variable "zone_id" {
  description = "Route53 zone the alias records are written into"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate covering the domain. Must be issued in us-east-1."
  type        = string
}

variable "assets_origin_domain_name" {
  description = "Regional domain name of the S3 bucket holding the static build output"
  type        = string
}

variable "server_origin_domain_name" {
  description = "Host of the Lambda Function URL running the application server"
  type        = string
}

variable "static_path_patterns" {
  description = "Paths served from the assets bucket instead of the server. A pattern the bucket does not hold answers 403 through the origin access control rather than falling through to the server, so only add one when the build output actually carries those keys."
  type        = list(string)
  default     = ["/_next/static/*"]
}

variable "price_class" {
  description = "Edge locations the distribution uses"
  type        = string
  default     = "PriceClass_100"
}
