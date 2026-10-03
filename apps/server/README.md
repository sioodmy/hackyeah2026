# @safecall/server

Fastify 5 + Drizzle + PostgreSQL. Trzyma alerty, znajomych, lokalizacje i
rozsyła wszystko po WebSocket.

## Uruchomienie

```sh
docker compose up -d postgres --rootdir ../..   # z katalogu repo
pnpm db:migrate
pnpm dev
```

Bez skonfigurowanego `CLERK_SECRET_KEY` serwer działa w trybie dev i ufa
nagłówkowi `x-dev-user`.

## Endpointy

Wszystkie wymagają autoryzacji (`Authorization: Bearer <clerk jwt>` albo
`x-dev-user` w trybie dev) i zwracają JSON. Błędy mają kształt
`{ "error": { "message", "code", "issues"? } }`.

| Metoda   | Ścieżka              | Co robi                                                                            |
| -------- | -------------------- | ---------------------------------------------------------------------------------- |
| `GET`    | `/health`            | bez autoryzacji: `{ ok, db, uptime, sockets }`                                     |
| `GET`    | `/api/me`            | profil zalogowanego                                                                |
| `GET`    | `/api/contacts`      | zaakceptowani znajomi + ich ostatnia lokalizacja                                   |
| `POST`   | `/api/contacts`      | `{ code }` — wymienia kod zaproszenia, tworzy relację w obie strony (idempotentne) |
| `DELETE` | `/api/contacts/:id`  | usuwa relację w obie strony                                                        |
| `POST`   | `/api/invites`       | jednorazowy kod QR na godzinę; zwraca podpisany payload                            |
| `GET`    | `/api/alerts`        | moje alarmy, od najnowszego                                                        |
| `GET`    | `/api/alerts/active` | jeden aktywny alarm albo `null`                                                    |
| `POST`   | `/api/alerts`        | `{ level 1..3, location, place?, alertId? }`                                       |
| `PATCH`  | `/api/alerts/:id`    | `{ status?, level?, note? }`                                                       |
| `POST`   | `/api/dispatch`      | **mock służb** — zwraca referencję, ETA i log operatora                            |
| `PUT`    | `/api/locations/me`  | zapisuje moją lokalizację i rozsyła ją znajomym                                    |
| `POST`   | `/api/devices`       | rejestracja tokenu push                                                            |

### Co robi `POST /api/alerts`

- **poziom 1** — tworzy alarm, **nikogo nie informuje**
- **poziom 2** — eskaluje, wysyła znajomym lokalizację i `callMe: true`, robi push
- **poziom 3** — to samo plus wywołuje `DispatchProvider` i zapisuje
  `dispatched_at` / `dispatch_reference`

## WebSocket

`GET /ws` (upgrade). Token bierz z nagłówka albo z `?token=`.

Od serwera: `locations`, `alert`, `alert:cleared`, `contact:upsert`,
`dispatch:ack`, `decoy:call`.
Od klienta: `location:ping`, `ping`.

Każda ramka to `WsEnvelope`: `{ type, at, payload }`. Sockets, które nie
odpowiedzą pingiem w 45 s, są zamykane.

## Struktura

```
src/config.ts               walidacja env (zod)
src/app.ts                  rejestracja wtyczek i handler błędów
src/index.ts                bootstrap i graceful shutdown
src/db/schema.ts            tabele drizzle
src/db/migrations/          SQL
src/db/migrate.ts           runner migracji
src/db/seed.ts              dwie demo-osoby, już ze sobą spojrzone
src/auth/clerk.ts           requireUser / identifyUpgrade
src/routes/                 contacts, alerts, locations, devices
src/realtime/hub.ts         rejestr połączeń i fan-out
src/realtime/routes.ts      upgrade + obsługa ramek
src/services/contacts.ts    zaproszenia, relacje, podpis QR (HMAC)
src/services/alerts.ts      cykl życia alarmu, powiadomienia
src/services/locations.ts   zapis i rozsyłanie lokalizacji
src/services/mock-dispatch.ts  atrapa 112/997/998
src/services/push.ts        Expo push, nigdy nie wywraca żądania
```

## Migracje

```sh
pnpm db:migrate   # idempotentny runner na SQL z src/db/migrations
pnpm db:seed      # demo-anna ↔ demo-marta
```

Model: `users`, `friendships`, `invite_codes`, `locations` (jedna na
użytkownika), `alerts`, `alert_recipients`, `device_tokens`.
