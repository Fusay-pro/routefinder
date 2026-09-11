-- RouteFinder v1 — PostgreSQL schema
-- Note: the routing graph (nodes/edges from OSM + campus overlay) is NOT stored here.
-- It's built into an in-memory structure loaded by each backend instance at boot.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

CREATE TYPE commute_mode AS ENUM ('walk', 'bike', 'motorcycle', 'car');
CREATE TYPE trip_status AS ENUM ('in_progress', 'completed', 'abandoned');
CREATE TYPE verification_status AS ENUM ('unverified', 'verified', 'flagged_review', 'rejected');
CREATE TYPE parking_status AS ENUM ('free', 'occupied', 'unknown');
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- ─────────────────────────────────────────────
-- users — auth + points balance
-- ─────────────────────────────────────────────
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT,                    -- null for Google-only accounts
    google_id       TEXT UNIQUE,             -- Google's account "sub" claim, null for email/password-only accounts
    display_name    TEXT,
    role            user_role NOT NULL DEFAULT 'user',
    points_balance  INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);

-- ─────────────────────────────────────────────
-- places — campus buildings/POIs, searchable by nickname
-- ─────────────────────────────────────────────
CREATE TABLE places (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name  TEXT NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE place_aliases (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id     UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    alias        TEXT NOT NULL,
    created_by   UUID REFERENCES users(id), -- admin who added it
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (place_id, alias)
);

CREATE INDEX idx_places_name ON places (lower(canonical_name));
CREATE INDEX idx_place_aliases_alias ON place_aliases (lower(alias));

-- ─────────────────────────────────────────────
-- trips — a routed + (optionally) GPS-verified journey
-- ─────────────────────────────────────────────
CREATE TABLE trips (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id),
    travel_mode           commute_mode NOT NULL,

    origin_place_id       UUID REFERENCES places(id),      -- null if user tapped the map
    origin_lat            DOUBLE PRECISION NOT NULL,
    origin_lng            DOUBLE PRECISION NOT NULL,

    destination_place_id  UUID REFERENCES places(id),
    destination_lat       DOUBLE PRECISION NOT NULL,
    destination_lng       DOUBLE PRECISION NOT NULL,

    suggested_route       JSONB NOT NULL,             -- [{lat,lng}, ...] returned by A*
    distance_meters       DOUBLE PRECISION NOT NULL,
    estimated_seconds     DOUBLE PRECISION NOT NULL,

    gps_trace             JSONB,                       -- [{lat,lng,t}, ...] recorded during the trip
    status                trip_status NOT NULL DEFAULT 'in_progress',
    verification_status   verification_status NOT NULL DEFAULT 'unverified',
    points_awarded        INTEGER NOT NULL DEFAULT 0,

    started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at              TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_user_id ON trips (user_id);
CREATE INDEX idx_trips_status ON trips (status);

-- ─────────────────────────────────────────────
-- redemption_catalog / redemptions — points economy
-- ─────────────────────────────────────────────
CREATE TABLE redemption_catalog (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    description  TEXT,
    point_cost   INTEGER NOT NULL CHECK (point_cost > 0),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE redemptions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id),
    catalog_item_id  UUID NOT NULL REFERENCES redemption_catalog(id),
    points_spent     INTEGER NOT NULL,
    redeemed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_redemptions_user_id ON redemptions (user_id);

-- ─────────────────────────────────────────────
-- parking_spots — v1 pilot (1 spot), but scales to N without redesign
-- ─────────────────────────────────────────────
CREATE TABLE parking_spots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label         TEXT NOT NULL,
    lat           DOUBLE PRECISION NOT NULL,
    lng           DOUBLE PRECISION NOT NULL,
    status        parking_status NOT NULL DEFAULT 'unknown',
    last_updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
