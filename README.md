# PanicMap

A map that looks like a map.

Fullscreen OpenStreetMap, one slider at the bottom, a small settings pill in the
corner. If someone is in a situation they want out of, they push the slider and
let go. Everything else — the fake incoming call, the push to their friends, the
live location, the authorities — happens without the screen changing into
something that would give them away.

Built for HackYeah 2026.

---

## How it works

The threat slider has four zones. You push the knob and **let go**; nothing
happens while your thumb is still down, which is deliberate — an accidental brush
across the screen must not start a call.

Each row is both sides of the alert: what your phone does, and what your friends'
phones do about it.

| Zone | Colour | What actually happens |
| --- | --- | --- |
| **0** | grey | Nothing. This is the resting state, and it is the state the app returns to after every action. |
| **1** | yellow | After **10 seconds** your phone fakes an incoming call: fullscreen call UI, a quiet looping ringtone, a repeating haptic pattern, a contact name. Answer it and you get an ambient call that runs for ~30s, then returns to the map. Decline it and the screen goes back to the map. Your friends get a **notification** — the heads-up is left to the OS, and nothing takes over their screen. |
| **2** | orange | Everything level 1 does, plus friends get a **call request**: a heads-up on its own channel with an "Odbierz" button on it. Tapping the notification or that button opens their phone fullscreen on a ringing call with your name on it. Answering is the thing you asked for, and answering reports back to you as "Kasia rozmawia". Your phone also starts streaming position over a WebSocket so their map moves. |
| **3** | red | Everything level 2 does, plus friends get an **alarm**: the critical channel (heads-up, `bypassDnd`, a long vibration), `time-sensitive`, and an "Idę do niej" button that opens their phone onto a looping siren at full volume — which only stops when they say what they are doing about it. Meanwhile the mock 112 dispatch fires and returns a case number, and **audio recording starts** (see below). |

Raising the slider again on a live alert **notifies again at the new level** — a
friend who only heard the level-1 notification has to hear the alarm. Dragging the
slider back to 0 resolves the alert, silences whatever is ringing on your friends'
phones, tells them it is over, and finalises the recording.

### Why it is unremarkable from a distance

- The OSM raster style is desaturated and dimmed (`raster-saturation: -0.45`), so
  the map is quiet and grey-brown.
- The slider is the only saturated element, and it only becomes saturated once
  you commit to a level.
- There is no word like "REC" or "ALARM" on screen. The recording indicator is a
  six-pixel dot at low opacity in the corner — it tells *you* your phone is
  capturing, and says nothing to anyone else.

### Evidence recording (level 3 only)

The phone records in **30-second segments** and uploads each one the moment it
closes. If the phone is taken, wiped or dies, the worst-case loss is one segment
rather than the whole recording. Cost: sub-second gaps at segment boundaries,
which the server's manifest records explicitly as `contiguous: false` rather than
hiding.

Each segment carries a SHA-256 that the server recomputes and verifies before
accepting it, and `seq` is unique per session, so retransmitting a segment is a
no-op instead of a corruption. Finalising writes a chain-of-custody manifest:
ordered segment digests, server receive times, client timestamps, and the
position at start and end.

Two platform facts, neither fixable from JavaScript:

- Android shows an **unavoidable** ongoing-microphone indicator while recording.
  The mitigation is the fake-call pretext — the phone is held to the user's ear,
  not lying on a table — not anything clever.
- `expo-audio` cannot route playback to the earpiece, so the ringtone plays at
  `volume 0.15` to keep it out of the recording.

---

## Repository layout

```
flake.nix          # 4 systems, treefmt-nix, devShell, packages, checks
justfile           # every task you'll actually run
scripts/db.sh      # postgres via docker compose, or the nix postgres
app/               # Expo SDK 56 · React Native 0.85 · expo-router · TypeScript
backend/           # FastAPI · SQLAlchemy 2 · psycopg · uv
infra/             # docker-compose, Dockerfile, .env.example
```

---

## Getting started

You need [direnv](https://direnv.net) with Nix, or just `nix develop`.

```bash
nix develop          # node, python, uv, postgres, just, docker
direnv allow         # optional: load the env automatically
just setup           # uv sync + npm install + app/.env
```

### Clerk

1. Create an application at [clerk.com](https://clerk.com).
2. Dashboard → API Keys → **Publishable key** (`pk_test_…`).
3. Dashboard → API Keys → **Show JWT public key** → copy the PEM block.
4. Fill in both:

```bash
# app/.env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…

# backend/.env
CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----\nMIIB…\n-----END PUBLIC KEY-----"
```

The backend verifies the session token locally with the public key — no network
round-trip to Clerk per request. With no key configured it **fails closed**: every
authenticated route returns 401 rather than trusting an unverified token.

### Database

```bash
just db-up       # docker compose if available, otherwise the nix postgres
just db-url      # prints DATABASE_URL — paste into backend/.env
just db-reset    # drop and recreate the schema
```

`scripts/db.sh` picks Docker when it is on `PATH` (that is what the deployed
server runs) and falls back to the Postgres from nixpkgs otherwise, so
`just db-up` works on a machine with neither Docker nor a system Postgres.

### Run

```bash
just api         # FastAPI on :8000 — REST + /ws/locations, docs at /docs
just app         # Expo dev server
```

**A development build is required.** MapLibre and Clerk both ship native code, so
Expo Go will not work:

```bash
just app-prebuild
just app-android   # or: just app-ios
```

On an Android emulator the API is at `http://10.0.2.2:8000`. On a physical phone
set `EXPO_PUBLIC_API_URL` in `app/.env` to your LAN address — or leave it unset
and it is inferred from the Metro host, which is usually right.

### Two phones, end to end

1. Sign in on both devices.
2. On one: Settings → Manage friends → show the QR.
3. On the other: Scan a friend's code.
4. On one: push the slider into yellow, let go. Ten seconds later it rings, and the
   other phone gets a notification.
5. Push it to orange. The other phone's **call request** takes over the screen.
   Answer it and the first phone's status line picks up "Kasia — rozmawia".
6. Push it to red. The other phone's alarm channel buzzes with an "Idę do niej"
   button; tapping it opens their phone onto the fullscreen looping siren, which
   stops only once the friend presses the button — which lands on the first phone
   as "Kasia — idzie do ciebie". `curl localhost:8000/api/v1/alerts/active` shows
   the acks plus the case number from the mock dispatch.

---

## Threat model and honest limits

- **Levels 0 and 1 leave the device only as a notification.** The fake call is
  generated on the phone; level 1 tells friends that you are not comfortable and
  nothing more, because a level that takes over a friend's screen for "I might need
  a minute" is a level they learn to swipe away.
- **There is no full-screen intent, so the notification is the wake-up call.**
  Android would only promote a notification to a full-screen intent when its
  category is `alarm` or `call`, and `expo-notifications` never puts the category
  on the notification — it only looks the category up to attach buttons. So levels
  2 and 3 are delivered as a heads-up with sound and vibration (plus `bypassDnd`
  at level 3), and the friend's tap — on the notification or on its "Odbierz" /
  "Idę do niej" button — is what opens the app onto the call or the alarm. A real
  full-screen intent needs a native module or a config plugin, which is more than
  a demo should carry.
- **A friend's phone with PanicMap killed gets the channel, not the app.** The
  siren, the fake call UI and the acknowledgements all need the app running; what
  the push does on its own is make noise and offer a button.
- **Alert delivery is Expo push, not the WebSocket.** Push reaches a phone with
  the app killed; the socket does not. Only live *positions* use the socket.
- **A single uvicorn worker on purpose.** The WebSocket registry is in-process
  memory. Running multiple workers needs Redis fan-out — noted in the README
  rather than half-built.
- **OpenStreetMap's public tiles** are fine for a demo, and their usage policy
  asks you not to rely on them at volume. Swap `EXPO_PUBLIC_OSM_TILE_URL`.
- **Covert recording is legally fraught.** In Poland, recording a private
  conversation without the other party's consent is art. 267a KK, and such a
  recording would likely be inadmissible. It is also a third party's personal
  data under RODO. The app is built for level-3-only use and the responsibility
  sits with the user, per our decision — but know what you are shipping.
- **No Docker output from the flake.** A nix store path cannot be meaningfully
  flattened into a container layer, so the image is built by `infra/Dockerfile`,
  which resolves dependencies with `uv` and needs no nix at all.

---

## Development

```bash
just check          # lint + typecheck + pytest + format check
just fmt            # treefmt: prettier, ruff, alejandra, shfmt, taplo
nix flake check     # same, hermetically, with postgres started for the tests
just nix-build      # the backend as a runnable nix closure
just nix-run        # run that closure
```

> The nix backend build resolves PyPI at build time (via `uv`), so on Linux it
> needs `--option sandbox false` — which is why the recipes pass it. On macOS
> there is no sandbox and the flag is a no-op.

`nix flake check` covers x86_64-linux, aarch64-linux, x86_64-darwin and
aarch64-darwin. nixpkgs is pinned to **26.05** rather than unstable because
unstable (26.11) has dropped x86_64-darwin.

### Backend layout

```
src/hy/
├── asgi.py          app factory, lifespan, /healthz, uvicorn entrypoint
├── config.py        pydantic-settings, one Settings object
├── db.py            engine, session_scope, run_db (threadpool for async handlers)
├── models.py        SQLAlchemy models
├── schemas.py       Pydantic request/response models (camelCase on the wire)
├── auth.py          Clerk verification for REST and the WS handshake
├── friends.py       friend graph queries
├── invites.py       signed QR payloads (HMAC, expiring)
├── push.py          Expo push message construction
├── dispatch.py      the mock 112
├── evidence.py      chunk store, digests, chain-of-custody manifest
├── realtime.py      connection registry and fan-out
├── ws.py            the /ws/locations protocol
└── routers/         devices, friends, alerts, authorities, locations, evidence
```

127 tests cover the level semantics, escalation re-notifying friends,
acknowledgements, evidence upload idempotency and digest verification, the
WebSocket fan-out and its privacy boundary, the signed QR payloads, and the mock
dispatch.

---

## Environment reference

| Variable | Where | Meaning |
| --- | --- | --- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `app/.env` | Clerk publishable key |
| `EXPO_PUBLIC_API_URL` | `app/.env` | Backend URL; inferred if unset |
| `EXPO_PUBLIC_OSM_TILE_URL` | `app/.env` | Tile template |
| `DATABASE_URL` | `backend/.env` | SQLAlchemy URL |
| `CLERK_JWT_KEY` | `backend/.env` | PEM public key, networkless verification |
| `CLERK_SECRET_KEY` | `backend/.env` | Fallback: JWKS via Backend API |
| `INVITE_SIGNING_KEY` | `backend/.env` | HMAC key for QR invites — **change it** |
| `EVIDENCE_DIR` | `backend/.env` | Where audio segments land |
| `EXPO_ACCESS_TOKEN` | `backend/.env` | Required for production push |