---
updated: 2026-09-17
source: setup
---

# infra: flows

Only flows that deserve a diagram. A CRUD does not.

## Request path

Every request from the browser goes through CloudFront, which splits by path: static assets go to the assets bucket, everything else goes to the Lambda running the Next.js server (middleware and API routes included). Scene uploads and downloads bypass the Lambda entirely, direct to S3 with a presigned URL.

```mermaid
sequenceDiagram
  participant B as Browser
  participant CF as CloudFront
  participant S3A as S3 (assets)
  participant L as Lambda (Next.js server)
  participant DB as DynamoDB (diagrams)
  participant S3S as S3 (scenes)

  B->>CF: GET /_next/static/* or public/*
  CF->>S3A: GetObject (via OAC)
  S3A-->>CF: static file
  CF-->>B: static file (cached)

  B->>CF: GET / , /login, /api/*
  CF->>L: forward (Function URL, AWS_IAM, via OAC)
  L->>DB: Scan / GetItem / PutItem / UpdateItem / DeleteItem
  DB-->>L: diagram index / item
  L->>S3S: sign a PUT or GET URL for scenes/{id}.json
  L-->>CF: response (incl. presigned URL)
  CF-->>B: response

  B->>S3S: PUT or GET scene JSON directly, with the presigned URL
  S3S-->>B: scene content
```
