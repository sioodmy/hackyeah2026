# Standalone Docker build for the Mokosh API.
#
# This image does not need Nix — it resolves Python dependencies with uv inside
# the build, so `docker compose up` works on a laptop that has never heard of
# this flake. The Nix build in flake.nix produces the same environment via
# `nix build .#api`.

FROM python:3.13-slim-bookworm AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /build

RUN pip install --no-cache-dir uv==0.12.11

# Dependencies first so the layer caches across source edits.
COPY backend/pyproject.toml backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY backend/README.md ./
COPY backend/src ./src

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev && \
    cp -r /build/.venv /opt/venv


FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    HY_HOST=0.0.0.0 \
    HY_PORT=8000

# curl is only here for the compose healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv

RUN useradd --system --uid 10001 --create-home mokosh \
    && mkdir -p /var/lib/mokosh/evidence \
    && chown -R mokosh:mokosh /var/lib/mokosh

USER mokosh
WORKDIR /home/mokosh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/healthz || exit 1

CMD ["hy-api"]