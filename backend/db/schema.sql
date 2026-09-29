-- Campus eco-commute competition — PostgreSQL schema
-- Note: the routing graph (nodes/edges from OSM + campus overlay) is NOT stored here.
-- It's built into an in-memory structure loaded by each backend instance at boot.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

CREATE TYPE commute_mode AS ENUM ('walk', 'run', 'bike', 'motorcycle', 'car');
CREATE TYPE trip_status AS ENUM ('in_progress', 'completed', 'abandoned');
CREATE TYPE verification_status AS ENUM ('unverified', 'verified', 'flagged_review', 'rejected');
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE faculty_change_status AS ENUM ('pending', 'approved', 'rejected');

-- ─────────────────────────────────────────────
-- faculties — the unit the faculty leaderboard ranks
-- ─────────────────────────────────────────────
CREATE TABLE faculties (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,        -- stable id for the UI, e.g. 'engineering'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- users — auth, faculty membership, points wallet
--
-- points_balance is a *wallet*: redemptions draw it down, so it is not and can
-- never be a leaderboard score. Boards aggregate trips instead.
-- ─────────────────────────────────────────────
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT,                    -- null for Google-only accounts
    google_id       TEXT UNIQUE,             -- Google's account "sub" claim, null for email/password-only accounts
    display_name    TEXT,
    role            user_role NOT NULL DEFAULT 'user',
    points_balance  INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    faculty_id      UUID REFERENCES faculties(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);

CREATE INDEX idx_users_faculty_id ON users (faculty_id);

-- ─────────────────────────────────────────────
-- faculty_change_requests — moving faculty needs an admin's approval
--
-- Users pick a faculty at signup but can't reassign themselves afterwards: the
-- faculty board is a competition between groups, so self-service switching
-- would let people stack whichever side is winning.
-- ─────────────────────────────────────────────
CREATE TABLE faculty_change_requests (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_faculty_id  UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    note                  TEXT,                    -- the user's justification, e.g. a student id
    status                faculty_change_status NOT NULL DEFAULT 'pending',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_by           UUID REFERENCES users(id),
    resolved_at           TIMESTAMPTZ
);

CREATE INDEX idx_faculty_change_requests_status ON faculty_change_requests (status);
-- One open request per user at a time; resolved ones are kept as history.
CREATE UNIQUE INDEX idx_faculty_change_requests_one_pending
    ON faculty_change_requests (user_id) WHERE status = 'pending';

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

    -- What actually happened, derived from gps_trace at completion. Distinct
    -- from distance_meters/estimated_seconds above, which are what was *planned*.
    -- Every leaderboard reads these, never the planned figures — otherwise the
    -- boards would rank people on routes they asked for rather than distance
    -- they covered. Null until the trip completes with a usable trace.
    actual_distance_meters   DOUBLE PRECISION,
    actual_duration_seconds  DOUBLE PRECISION,
    -- The part of actual_distance_meters that counted, after the campus
    -- geofence and daily caps in services/scoringRules.ts.
    scoring_distance_meters  DOUBLE PRECISION,
    co2_saved_grams          DOUBLE PRECISION,

    started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at              TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_user_id ON trips (user_id);
CREATE INDEX idx_trips_status ON trips (status);
-- Every leaderboard query is a time-window scan over verified trips, and the
-- daily caps re-read today's verified trips on every completion. Partial, since
-- nothing else is ever aggregated.
CREATE INDEX idx_trips_leaderboard ON trips (started_at) WHERE verification_status = 'verified';
CREATE INDEX idx_trips_user_started ON trips (user_id, started_at);

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
