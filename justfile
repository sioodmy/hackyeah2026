# Load app/.env and backend/.env, so `just` sees the same configuration the
# tools do.
set dotenv-load := true

# Show the available recipes.
default:
    @just --list --unsorted

# ---------------------------------------------------------------------------
# setup
# ---------------------------------------------------------------------------

# Install everything: python venv, JS dependencies, create app/.env.
setup:
    cd backend && uv sync
    cd app && npm install
    @if [ ! -f app/.env ]; then cp app/.env.example app/.env; echo "created app/.env — fill in the Clerk key"; fi

# ---------------------------------------------------------------------------
# run
# ---------------------------------------------------------------------------

# FastAPI on :8000 — REST plus /ws/locations.
api:
    cd backend && uv run uvicorn hy.asgi:app --reload --host 0.0.0.0 --port 8000

# Same, without auto-reload.
api-prod:
    cd backend && uv run uvicorn hy.asgi:app --host 0.0.0.0 --port 8000 --workers 1

# Expo dev server for a development build (MapLibre and Clerk need one).
app *args:
    cd app && npx expo start --dev-client {{args}}

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
    cd backend && uv run python -c "from hy.asgi import _init_database; _init_database(); print('schema recreated')"

# ---------------------------------------------------------------------------
# checks
# ---------------------------------------------------------------------------

# Format everything in place (treefmt: prettier, ruff, alejandra, shfmt).
fmt:
    nix fmt

# Report what would change, without writing.
fmt-check:
    nix fmt -- --fail-on-change

lint:
    cd backend && uv run ruff check src tests
    cd app && npx tsc --noEmit

# Everything that gates a commit.
check: lint backend-test fmt-check

backend-test:
    cd backend && uv run pytest -q

typecheck:
    cd app && npx tsc --noEmit

# ---------------------------------------------------------------------------
# nix package
# ---------------------------------------------------------------------------

# Build the backend as a runnable nix closure. Needs network at build time
# (uv resolves PyPI), so on Linux the sandbox must be relaxed for this one.
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