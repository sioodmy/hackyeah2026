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

- The raster basemap is desaturated and dimmed (`raster-saturation: 0` on the CARTO
  dark tiles, `-0.92` on the daylight OSM fallback, `raster-brightness-max` between
  0.58 and 1), so the map is quiet and grey-brown.
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

## The danger heatmap

The slider is for *your* emergency. The heatmap is for the city: reported
aggression across Kraków, drawn as translucent cells that get hotter the more
incidents land in them.

Privacy rules are the whole design, and they are enforced server-side rather than
by the client:

- **Reads are grid-snapped.** `GET /api/v1/incidents/heatmap` returns ~200 m cells
  with counts and weights, never a point and never a person. There is no
  `user_id` anywhere in the response.
- **Reports are anonymous, reads are not.** `POST /api/v1/incidents` accepts a
  report without a session — a stranger being followed should not have to sign up
  to file one — but all three read endpoints require a valid token.
- **Your own reports stay yours.** `GET /api/v1/incidents` returns only the
  caller's, so a device can show "you reported this" without ever exposing anyone
  else's.
- **Weight is server-derived.** A client-supplied weight is ignored; severity
  comes from the category, and coordinates outside the Kraków bounding box are
  rejected.

The seed data is **invented** — 45 fabricated reports on real Kraków streets —
and is therefore off by default. Without `HY_SEED_DEMO_INCIDENTS=1` a fresh
database shows an empty heatmap, which means "nobody has reported anything", not
"the seed broke". Turn it on for a demo; leave it off for anything real, because
invented rows are indistinguishable from real ones once they are in the table.

## Profile

Name, an emoji avatar and one of six signature auras, set in Settings. The friend
map marker shows all three, and the same fields travel in the alert push, so the
call request that lands on a friend's phone reads "Kasia" rather than a raw user
id. Clamped and validated server-side; `PATCH /api/v1/users/me` distinguishes
"field omitted" from "field explicitly null", so clearing a name does not wipe the
avatar next to it.

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
- **No migrations.** The schema is created with `Base.metadata.create_all` on
  boot, on the grounds that a hackathon does not need Alembic. The consequence is
  that any schema change against an existing database is a manual
  `DROP SCHEMA public CASCADE`. Fine until the first one, which is why it is
  written down here.
- **No rate limiting.** Nothing stops anyone from POSTing to
  `/api/v1/incidents` in a loop. Reports are bounded by a category whitelist, the
  Kraków bounding box and server-derived weight, but not by volume.
- **The evidence manifest has no screen.** Segments upload, digests verify and the
  chain-of-custody manifest freezes, and six endpoints expose all of it — none of
  which the app reads. The recorder is wired up; the playback view is not built.
- **The API surface is wider than the app.** Roughly six routes and five client
  methods have no caller on either side. They were built so the demo had room to
  grow, not because something uses them.
- **No iOS build.** The release workflow builds Android only.

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
└── routers/         users, devices, friends, alerts, authorities, locations,
                     evidence, incidents
```

131 tests cover the level semantics, escalation re-notifying friends,
acknowledgements, evidence upload idempotency and digest verification, the
WebSocket fan-out and its privacy boundary, the signed QR payloads, the mock
dispatch, and the heatmap's authorisation boundary.

There are no tests on the app side. That is the largest gap in the repository and
it is not subtle: `theme/levels.ts` and `lib/avatar.ts` are pure, and
`useSmoothedLocations` even takes an injectable clock so it *can* be tested. It
matters because the fractional-level slider bug that shipped as PR #6 — where
releasing the knob passed `0.37` to a state machine and an API field typed
`int` — is exactly the class of bug a twenty-line unit test catches.

---

## Environment reference

| Variable | Where | Meaning |
| --- | --- | --- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `app/.env` | Clerk publishable key |
| `EXPO_PUBLIC_API_URL` | `app/.env` | Backend URL; inferred if unset |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | `app/.env` | EAS project id, or read from `extra.eas.projectId` |
| `EXPO_PUBLIC_OSM_TILE_URL` | `app/.env` | Tile template |
| `DATABASE_URL` | `backend/.env` | SQLAlchemy URL |
| `CLERK_JWT_KEY` | `backend/.env` | PEM public key, networkless verification |
| `CLERK_SECRET_KEY` | `backend/.env` | Fallback: JWKS via Backend API |
| `INVITE_SIGNING_KEY` | `backend/.env` | HMAC key for QR invites — **change it** |
| `EVIDENCE_DIR` | `backend/.env` | Where audio segments land |
| `EXPO_ACCESS_TOKEN` | `backend/.env` | Required for production push |
| `HY_SEED_DEMO_INCIDENTS` | `backend/.env` | Fill the heatmap with invented demo reports |

---

## Releasing

Push a `v*` tag and the `release` workflow builds a release APK and attaches it to
the GitHub Release. It derives `expo.version` and `android.versionCode` from the
tag (`major*10000 + minor*100 + patch`, so v0.3.0 → 300) so a build always installs
over the last one.

```bash
gh secret  set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY   # pk_…   — gates the build
gh variable set EAS_PROJECT_ID        --body "<uuid>"     # gates the build
gh variable set EXPO_PUBLIC_API_URL   --body "https://…"  # gates the build

git tag v0.3.0 && git push origin v0.3.0
```

All three are **hard gates**, not defaults, and each one fails a build that would
otherwise install cleanly and then break at runtime:

| Missing | What the APK does instead |
| --- | --- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Installs, then the app throws at import and nobody can sign in |
| `EAS_PROJECT_ID` | Installs, then cannot mint a push token — so the account can never alert a friend |
| `EXPO_PUBLIC_API_URL` | Installs, then points at nothing and every screen that needs data fails |

`EAS_PROJECT_ID` is injected into `extra.eas.projectId` before prebuild rather
than read from a local `.env`, so a release never depends on one developer's
machine. If push registration is silently broken, `usePushRegistration` now logs
the reason instead of swallowing it.

The APK is signed with the **debug key**. That is fine for judges sideloading it
and wrong for the Play Store.