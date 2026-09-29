# Backend Database Schema

Date: 2026-09-10 (revised 2026-09-29 for the eco-competition pivot)

PostgreSQL schema for the backend. Source of truth is [`schema.sql`](./schema.sql) in this folder — this file is a readable reference for the same tables.

Note: the routing graph (nodes/edges from the OSM extract + hand-curated campus overlay) is **not** stored in Postgres. It's built into an in-memory structure loaded by each backend instance at boot, since it's read-only and must be identical across every stateless instance.

## faculties — the unit the faculty leaderboard ranks

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "Engineering" |
| slug | text, unique | stable id for the UI, e.g. `engineering` |
| created_at | timestamptz | |

Seeded from [`seed.sql`](./seed.sql) with the Thammasat Rangsit faculties.

## users — auth, faculty membership, points wallet

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| email | text, unique | never exposed on a leaderboard |
| password_hash | text, nullable | null for Google-only accounts |
| google_id | text, unique, nullable | Google's account "sub" claim; null for email/password-only accounts |
| display_name | text | **required at signup** — it's what the boards show |
| role | enum: `user`, `admin` | admin approves faculty changes, curates places/catalog |
| points_balance | integer, ≥0 | a *wallet*, not a score — see below |
| faculty_id | uuid FK → faculties, nullable | on delete set null; null only for Google-created accounts that haven't picked one |
| created_at / updated_at | timestamptz | |

`points_balance` can never serve as a leaderboard metric: redemptions draw it
down, so someone who spends their points would drop down the board for
spending them. Boards aggregate `trips` instead.

## faculty_change_requests — moving faculty needs an admin's approval

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | on delete cascade |
| requested_faculty_id | uuid FK → faculties | on delete cascade |
| note | text, nullable | the user's justification |
| status | enum: `pending`, `approved`, `rejected` | |
| created_at | timestamptz | |
| resolved_by | uuid FK → users, nullable | the admin who decided |
| resolved_at | timestamptz, nullable | |

Users pick a faculty at signup and can't reassign themselves afterwards — the
faculty board is a contest between groups, so self-service switching would let
people pile onto whichever one is winning. A partial unique index on
`(user_id) WHERE status = 'pending'` allows one open request at a time while
keeping resolved ones as history.

## places — campus buildings/POIs

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| canonical_name | text | |
| lat / lng | double precision | |
| created_at / updated_at | timestamptz | |

## place_aliases — nicknames, one-to-many off places

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| place_id | uuid FK → places | on delete cascade |
| alias | text | unique per place |
| created_by | uuid FK → users | which admin added it |
| created_at | timestamptz | |

Search matches `places.canonical_name` or any `place_aliases.alias`, both lowercase-indexed.

## trips — a routed and (optionally) GPS-verified journey

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| travel_mode | enum: `walk`, `run`, `bike`, `motorcycle`, `car` | |
| origin_place_id | uuid FK → places, nullable | null if user tapped the map |
| origin_lat / origin_lng | double precision | always set |
| destination_place_id | uuid FK → places, nullable | |
| destination_lat / destination_lng | double precision | |
| suggested_route | jsonb | the whole `RouteResult`: `source`, distance, seconds, `estimatedPoints`, and either `path` (own-graph) or `polyline` (Google) |
| distance_meters | double precision | |
| estimated_seconds | double precision | |
| gps_trace | jsonb, nullable | array of `{lat,lng,t}` recorded live |
| status | enum: `in_progress`, `completed`, `abandoned` | |
| verification_status | enum: `unverified`, `verified`, `flagged_review`, `rejected` | |
| points_awarded | integer | |
| actual_distance_meters | double precision, nullable | what the GPS trace says actually happened |
| actual_duration_seconds | double precision, nullable | likewise |
| scoring_distance_meters | double precision, nullable | the part of the above that counted, after the geofence and daily caps |
| co2_saved_grams | double precision, nullable | frozen at completion from `scoring_distance_meters` |
| started_at / ended_at / created_at | timestamptz | |

**Planned vs actual.** `distance_meters` / `estimated_seconds` are what the
router *proposed*; `actual_*` are what the GPS trace says *happened*. Every
leaderboard reads `scoring_distance_meters` and `co2_saved_grams`, never the
planned figures — otherwise the boards would rank people on routes they asked
for rather than distance they covered. The `actual_*` columns are null for
trips completed before 2026-09-29 and for any trip abandoned without a usable
trace.

**Why a scoring distance separate from the actual one.** A trip can be
genuinely verified and still not count: both ends have to be inside
`CAMPUS_BOUNDS`, origin and destination have to be at least 250m apart, and
there are daily caps on both trip count and distance. Those rules live in
[`src/services/scoringRules.ts`](../src/services/scoringRules.ts). A trip past
the daily distance cap keeps the part under it rather than losing the whole
trip. Storing the result means the boards never re-derive it.

**Leaderboard indexes.** `idx_trips_leaderboard ON trips (started_at) WHERE
verification_status = 'verified'` is partial because verified trips are the
only rows ever aggregated; `idx_trips_user_started ON trips (user_id,
started_at)` serves the per-user daily cap lookup on every completion.

## redemption_catalog — admin-editable placeholder items

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| description | text | |
| point_cost | integer, >0 | |
| is_active | boolean | |
| created_at / updated_at | timestamptz | |

## redemptions — a user spending points on a catalog item

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| catalog_item_id | uuid FK → redemption_catalog | |
| points_spent | integer | |
| redeemed_at | timestamptz | |

## Backend scaffold

- `backend/package.json` — Express + pg, TypeScript, `db:migrate` script that runs `schema.sql` against `DATABASE_URL`.
- `backend/tsconfig.json` — strict TypeScript, NodeNext modules.
- `backend/.env.example` — `DATABASE_URL`, `PORT`.
