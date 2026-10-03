# PanicMap API

FastAPI backend for the PanicMap mobile app.

- `POST /api/v1/alerts` — create an alert (threat level 1–3), fan out Expo pushes,
  and at level 3 open an evidence-recording session + fire a mock dispatch.
- `WS /ws/locations` — live friend locations over a native WebSocket.
- `POST /api/v1/evidence/sessions/{id}/chunks` — segmented audio upload used as
  potential evidence at threat level 3.

Interactive API docs are served at `/docs`.

See the repository root README for setup instructions.
