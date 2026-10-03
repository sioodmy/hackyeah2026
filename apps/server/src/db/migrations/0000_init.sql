CREATE TYPE friend_status AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE alert_status AS ENUM ('active', 'escalated', 'resolved', 'cancelled');
CREATE TYPE device_platform AS ENUM ('ios', 'android');
CREATE TYPE device_provider AS ENUM ('expo', 'fcm', 'apns');

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'Anonimowa',
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_display_name_idx ON users (display_name);

CREATE TABLE IF NOT EXISTS friendships (
  owner_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status     friend_status NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, friend_id)
);
CREATE INDEX IF NOT EXISTS friendships_friend_idx ON friendships (friend_id);

CREATE TABLE IF NOT EXISTS invite_codes (
  code         TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  used_by      TEXT REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS invite_codes_user_idx ON invite_codes (user_id);

CREATE TABLE IF NOT EXISTS locations (
  user_id       TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  lat           NUMERIC(9, 6) NOT NULL,
  lng           NUMERIC(9, 6) NOT NULL,
  accuracy      REAL,
  heading       REAL,
  speed         REAL,
  battery_level REAL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  level              INTEGER NOT NULL DEFAULT 1,
  status             alert_status NOT NULL DEFAULT 'active',
  lat                NUMERIC(9, 6),
  lng                NUMERIC(9, 6),
  place              TEXT,
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at        TIMESTAMPTZ,
  dispatched_at      TIMESTAMPTZ,
  dispatch_reference TEXT
);
CREATE INDEX IF NOT EXISTS alerts_user_created_idx ON alerts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS alert_recipients (
  id              TEXT PRIMARY KEY,
  alert_id        TEXT NOT NULL REFERENCES alerts (id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel         TEXT NOT NULL DEFAULT 'realtime',
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS alert_recipients_unique_idx
  ON alert_recipients (alert_id, user_id);
CREATE INDEX IF NOT EXISTS alert_recipients_user_idx ON alert_recipients (user_id);

CREATE TABLE IF NOT EXISTS device_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   device_platform NOT NULL,
  provider   device_provider NOT NULL DEFAULT 'expo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_token_idx ON device_tokens (token);