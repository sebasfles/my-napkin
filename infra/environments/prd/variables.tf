variable "app_password" {
  description = "Password the login form compares against, injected into the server function"
  type        = string
  sensitive   = true
}

variable "session_secret" {
  description = "HMAC key the session cookie is signed with, injected into the server function"
  type        = string
  sensitive   = true
}
