# Load app/.env and backend/.env, so `just` sees the same configuration the
# tools do.
set dotenv-load := true

# Show the available recipes.
default:
    @just --list --unsorted

# ---------------------------------------------------------------------------
# setup
# ---------------------------------------------------------------------------

# Install everything: backend node_modules, app node_modules, create app/.env.
setup:
    cd backend && npm install
    cd app && npm install
    @if [ ! -f app/.env ]; then cp app/.env.example app/.env; echo "created app/.env — fill in the Clerk key"; fi
    @if [ ! -f backend/.env ]; then cp backend/.env.example backend/.env; echo "created backend/.env — fill in CLERK_JWKS_URL"; fi

# ---------------------------------------------------------------------------
# run
# ---------------------------------------------------------------------------

# Fastify on :8000 — REST plus OpenAPI docs at /docs.
api:
    cd backend && npm run dev

# Same, without auto-reload. Run `just build-api` first.
api-prod:
    cd backend && npm start

# Compile the backend to backend/dist.
build-api:
    cd backend && npm run build

# The escalation worker: promotes a level-2 alert nobody has acknowledged.
# Must run alongside `just api` — the API records, this promotes.
worker:
    cd backend && npm run worker

# Create the database if missing and apply migrations.
db-setup:
    cd backend && npm run setup

# Expo dev server for a development build (MapLibre and Clerk need one).
app *args:
    cd app && npx expo start --dev-client {{args}}

# Vite dev server for the hackathon landing page & simulator.
landing:
    cd landing && npm run dev

# Build the landing page for production.
landing-build:
    cd landing && npm run build

# Web-only UI preview (branch web/preview): mock bez backendu, bez buildów
# Androida. Szybka iteracja nad wyglądem, potem przeklejka do app/src.
web:
    cd web && npm run dev

# Produkcja preview do statycznego podglądu.
web-build:
    cd web && npm run build


# Build and run on a connected Android device or emulator.
app-android:
    cd app && npx expo run:android

# Download and install the latest release APK on a connected device via adb.
install-release *args:
    ./scripts/install-release.sh {{args}}

app-ios:
    cd app && npx expo run:ios

# Regenerate the native projects after changing app.json plugins.
app-prebuild:
    cd app && npx expo prebuild --clean

# Release APK wired to a backend running on this machine, rather than to the
# published server. Point app/.env at EXPO_PUBLIC_API_URL (emulator:
# http://10.0.2.2:8000, phone: http://<lan-ip>:8000); an http:// URL also turns
# on Android cleartext for that build via app/plugins/withCleartextTraffic.js.
# Needs a JDK 17 and the Android SDK on PATH. The APK lands in
# app/android/app/build/outputs/apk/release/app-release.apk.
app-release-apk:
    cd app && npx expo prebuild --platform android --clean
    cd app/android && ./gradlew assembleRelease --no-daemon

# ---------------------------------------------------------------------------
# database
# ---------------------------------------------------------------------------

# Print the DATABASE_URL for the database that is actually running.
db-url:
    ./scripts/db.sh url

# Start postgres: docker compose if available, else the nix postgres.
db-up:
    ./scripts/db.sh up

db-down:
    ./scripts/db.sh down

db-restart:
    ./scripts/db.sh restart

db-status:
    ./scripts/db.sh status

db-psql *args:
    ./scripts/db.sh psql {{args}}

# Drop and recreate every table (development only).
db-reset:
    ./scripts/db.sh psql -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' || true
    cd backend && npm run db:migrate

# ---------------------------------------------------------------------------
# checks
# ---------------------------------------------------------------------------

# Format everything in place (treefmt: prettier, alejandra, shfmt, taplo).
fmt:
    nix fmt

# Report what would change, without writing.
fmt-check:
    nix fmt -- --fail-on-change

lint:
    cd backend && npm run typecheck
    cd app && npx tsc --noEmit

# Everything that gates a commit.
check: lint backend-test fmt-check

backend-test:
    cd backend && npm test

typecheck:
    cd app && npx tsc --noEmit

# ---------------------------------------------------------------------------
# nix package
# ---------------------------------------------------------------------------

# Build the backend as a runnable nix closure. Needs network at build time
# (npm registry), so on Linux the sandbox must be relaxed for this one.
nix-build:
    nix build .#api --option sandbox false

nix-run *args:
    nix run . --option sandbox false -- {{args}}

# ---------------------------------------------------------------------------
# infrastructure
# ---------------------------------------------------------------------------

# Postgres + API via docker compose.
up:
    docker compose -f infra/docker-compose.yml up --build

down:
    docker compose -f infra/docker-compose.yml down

logs:
    docker compose -f infra/docker-compose.yml logs -f api