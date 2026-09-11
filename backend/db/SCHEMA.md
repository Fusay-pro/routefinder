# RouteFinder — Backend Database Schema (v1)

Date: 2026-09-10

PostgreSQL schema for the RouteFinder backend. Source of truth is [`schema.sql`](./schema.sql) in this folder — this file is a readable reference for the same tables.

Note: the routing graph (nodes/edges from the OSM extract + hand-curated campus overlay) is **not** stored in Postgres. It's built into an in-memory structure loaded by each backend instance at boot, since it's read-only and must be identical across every stateless instance.

## users — auth + points balance

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| email | text, unique | |
| password_hash | text, nullable | null for Google-only accounts |
| google_id | text, unique, nullable | Google's account "sub" claim; null for email/password-only accounts |
| display_name | text | |
| role | enum: `user`, `admin` | admin needed for aliases/catalog/parking management |
| points_balance | integer, ≥0 | |
| created_at / updated_at | timestamptz | |

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
| travel_mode | enum: `walk`, `bike`, `motorcycle`, `car` | |
| origin_place_id | uuid FK → places, nullable | null if user tapped the map |
| origin_lat / origin_lng | double precision | always set |
| destination_place_id | uuid FK → places, nullable | |
| destination_lat / destination_lng | double precision | |
| suggested_route | jsonb | array of `{lat,lng}` from A* |
| distance_meters | double precision | |
| estimated_seconds | double precision | |
| gps_trace | jsonb, nullable | array of `{lat,lng,t}` recorded live |
| status | enum: `in_progress`, `completed`, `abandoned` | |
| verification_status | enum: `unverified`, `verified`, `flagged_review`, `rejected` | |
| points_awarded | integer | |
| started_at / ended_at / created_at | timestamptz | |

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

## parking_spots — v1 pilot, one row today, scales to N without a redesign

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| label | text | e.g. "Lot A – Spot 1" |
| lat / lng | double precision | |
| status | enum: `free`, `occupied`, `unknown` | |
| last_updated | timestamptz | set by the sensor's status-post endpoint |
| created_at | timestamptz | |

## Backend scaffold

- `backend/package.json` — Express + pg, TypeScript, `db:migrate` script that runs `schema.sql` against `DATABASE_URL`.
- `backend/tsconfig.json` — strict TypeScript, NodeNext modules.
- `backend/.env.example` — `DATABASE_URL`, `PORT`.
