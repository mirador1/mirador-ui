# Port Map

All local URLs exposed by the full stack (UI + backend + observability). Ports can be overridden via `.env` — see [environment.md](environment.md).

| Service | URL |
|---|---|
| This UI | http://localhost:4200 |
| Docker API (control + proxy) | http://localhost:3333 |
| Backend API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Grafana (metrics) | http://localhost:3000 |
| Grafana LGTM (traces/logs) | http://localhost:3001 |
| Prometheus | http://localhost:9091 |
| Zipkin / Tempo | http://localhost:9411 |
| Pyroscope | http://localhost:4040 |
| Loki | http://localhost:3100 |
| pgAdmin | http://localhost:5050 |
| Kafka UI | http://localhost:9080 |
| RedisInsight | http://localhost:5540 |
| Keycloak | http://localhost:9090/admin |
