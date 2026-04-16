# Messaging

Kafka KRaft (no ZooKeeper) — customer creation pipeline, topic configuration, and monitoring tools.

## Kafka KRaft — no ZooKeeper

A single-broker Kafka cluster running in KRaft (Kafka Raft) mode. No external ZooKeeper process is needed — the broker manages its own metadata via an internal Raft log.

## Customer Creation Pipeline

End-to-end flow triggered by a single `POST /customers`.

1. **POST /customers** — Saves customer to PostgreSQL, then publishes a `CustomerCreatedEvent` to the `customer-events` topic.
2. **CustomerEnrichmentConsumer** — Reads the event from `customer-events` (consumer group: `customer-service-group`).
3. **Ollama llama3.2** — Calls the local LLM to generate a customer bio. Falls back to a mock response if Ollama is unavailable.
4. **Enrich & persist** — Updates the customer record with the generated bio in PostgreSQL.
5. **SSE push** — Publishes the enriched customer to the Server-Sent Events stream — the Angular UI receives it in real time without polling.

## Topic Configuration

- **Topic: customer-events** — 3 partitions · replication factor 1 (dev) · consumer group: `customer-service-group`
- **Trace propagation** — TraceId injected into Kafka message headers so spans link across producer → broker → consumer.

### Monitoring Tools

- **Kafka UI — :9080** — Browse topics, messages, and consumer groups.

---
[← Back to architecture index](README.md)
