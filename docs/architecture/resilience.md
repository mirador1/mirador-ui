# Resilience

Four resilience patterns wired into real production paths — all demonstrable interactively from the Diagnostic and Chaos pages.

Each pattern is wired into a real production path and can be triggered interactively from the Diagnostic and Chaos pages without writing any code.

## Rate Limiting — Bucket4j

Token-bucket algorithm, 10 requests/second per IP on customer endpoints. Excess requests receive HTTP 429 with a `Retry-After` header indicating the remaining wait time in milliseconds.

## Circuit Breaker — Resilience4j

Wraps outbound calls to Ollama AI. Opens after 5 consecutive failures, transitions to half-open state after 30 seconds and probes with a single request before closing again.

## Retry — Resilience4j

Exponential backoff on transient failures from Redis and Kafka. Maximum 3 attempts. Only retries on specific exception types to avoid masking permanent errors.

## Idempotency Keys

Client sends `Idempotency-Key: <uuid>` header on mutating requests. The server stores the response in Redis for 24 hours. A duplicate POST within the window returns the cached response without re-executing the operation.

---
[← Back to architecture index](README.md)
