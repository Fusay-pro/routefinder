# RouteFinder — Design Spec (v1)

Date: 2026-09-10

## Problem

Students and staff at the university often choose inefficient commuting paths, making them late to class. Google Maps and similar tools don't reflect campus-specific pedestrian shortcuts, don't compare walking vs. vehicle modes well for a campus context, and can't show real-time local conditions (e.g. construction, or whether an informal transport option is currently available).

RouteFinder solves the *routing* half of this problem for v1: given an origin and destination, compute and show the actually-fastest route, aware of multiple commute modes, using a graph that's far more detailed on campus than generic map data.

Two related ideas were considered and explicitly deferred to v2 because they require infrastructure outside pure software (see "Out of scope" below): live driver/ride availability, and a full parking/bicycle-queue system.

## Goals (v1)

- Given an origin, destination, and a chosen commute mode, return the fastest route and ETA.
- Support four commute modes: walk, bike, motorcycle, car.
- Reward users with points for verified walking/biking trips, redeemable via a placeholder catalog.
- Let users search for campus buildings by common nicknames, not just official names.
- Pilot a single parking-spot occupancy sensor, end-to-end, at small scale but with a scalable data model.

## Out of scope (v2+)

- Live driver/ride availability matching (e.g. "is a motorcycle-taxi available right now") — needs a driver-side app, live GPS ingestion, and matching logic; too large to bundle into v1 routing.
- Full parking system across campus, and public bicycle queue system — v1 only pilots one parking spot to validate the sensor → backend → map pipeline.
- Real partner-merchant integration for rewards redemption — v1 ships a placeholder/admin-editable catalog.
- Crowdsourced building nickname submissions — v1 aliases are admin-maintained only.

## Architecture

- **Backend**: Node/TypeScript service, deployed as multiple stateless instances behind a load balancer (e.g. Nginx or a cloud LB) and a CDN/reverse proxy (e.g. Cloudflare) in front for DDoS protection and basic rate limiting (per-IP and per-user).
  - Every instance is stateless per-request and loads the same graph snapshot into memory at boot — no sticky sessions needed, since any instance can answer any route query identically.
  - When the graph changes (new paths, campus edits), a new snapshot is built and instances reload/restart to pick it up.
- **Shared state**: Postgres database — the only stateful component, shared across all backend instances. Holds users, points ledger, trips, redemption catalog/redemptions, building aliases, and parking spot status.
- **Clients**: React (web) and React Native (mobile), both calling the same load-balanced backend API. Chosen because the team already knows React; shares logic/patterns across web and mobile.

## Routing engine & graph model

- **Nodes**: points where paths/roads meet or change direction — intersections, path junctions, building entrances. Each has a lat/lng.
- **Edges**: a direct segment between two nodes with no junctions in between (a stretch of sidewalk, road, or path). Each edge stores:
  - `distance` (meters, derived from node coordinates)
  - `modes`: which of `walk`, `bike`, `motorcycle`, `car` are allowed on this edge
  - `speed` per allowed mode — this converts distance into *time*, which is what routing actually optimizes for (not raw distance), matching the goal of avoiding lateness.
- **Two-tier graph**: the base graph is built from a country-wide OpenStreetMap extract (standard road/path network everywhere, filtered to relevant road classes to keep the in-memory graph manageable at that scale). The campus area is layered with an extra-dense, hand-curated set of paths (shortcuts, building entrances, pedestrian-only routes) merged into the same graph. This lets a trip start anywhere in the country and end anywhere on campus, seamlessly switching graph density as it crosses the campus boundary.
- **Algorithm**: A* (not plain Dijkstra) — same cost-tracking approach, but guided by a straight-line-distance-to-destination heuristic (converted to a best-case time) so it explores toward the goal instead of expanding equally in every direction. Necessary given the country-scale base graph.
- **Query flow**: given origin, destination, and mode, filter/weight edges to only those allowed for that mode, then run A* to find the minimum-*time* path.

## Rewards system

Core to the product pitch, not a bolt-on — designed in from v1.

- **Trip verification**: after a user requests a walking or biking route, they start the trip in-app; the app records a GPS trace during the trip. A trip qualifies for points only if:
  - The trace stays within ~25m of the suggested route for most of its points (path adherence), **and**
  - The average speed falls within a plausible range for the claimed mode (e.g. ~2–7 km/h for walking).
  - Traces that are unusually smooth/linear (lacking normal GPS jitter, a common signature of spoofing tools) are flagged for manual review rather than auto-rejected.
  - A daily cap on reward-eligible trips per user, plus rate-limiting on the trip-submission endpoint, bounds farming attempts.
  - Lost GPS mid-trip (app closed, signal lost) saves the trip as an unverified partial record — no points awarded, no crash.
- **Points formula**: flat rate by mode and distance — e.g. walk = 10 pts/km, bike = 5 pts/km, motorcycle/car = 0 pts. Simple, transparent, tunable later.
- **Redemption**: a small, admin-editable placeholder catalog (e.g. free coffee, library fine waiver, print credit) to validate the points → redemption flow end-to-end. Real partner benefits are sourced later.

## Building name search

- A **places** table holds each campus building/POI with one canonical name plus a list of admin-maintained aliases/nicknames (the informal names students actually use, which OSM/Google won't have).
- Search matches against canonical name and aliases.
- If search finds no match, there is no fuzzy "did you mean" fallback — the user can simply tap a point directly on the map to set it as origin/destination.

## Parking pilot (v1-lite)

Kept intentionally small (one physical sensor/spot) to validate the pipeline before any wider hardware rollout, but the data model is written to scale to many spots without redesign.

- `parking_spots` table: `id`, `location` (lat/lng), `status` (`free`/`occupied`), `last_updated`.
- An authenticated endpoint the sensor (or a manual test script, if hardware isn't wired up yet) posts status updates to.
- Map UI shows each known spot with a free/occupied marker.
- No historical analytics, prediction, or multi-spot aggregation logic in v1 — just prove sensor → backend → map display works end to end.

## Data model summary

- `users`: auth, points balance.
- `trips`: user, mode, route taken, GPS trace, distance, verification status, points awarded, timestamp.
- `redemption_catalog`: admin-editable placeholder items (name, point cost).
- `redemptions`: user, item, points spent, timestamp.
- `places`: canonical name, aliases, location.
- `parking_spots`: id, location, status, last_updated.
- Graph (nodes/edges) is not stored in Postgres — it's built from the OSM extract + campus overlay into an in-memory structure loaded by each backend instance.

## Error handling & edge cases

- **No route found** (disconnected graph): return a clear "no path found" error; graph connectivity issues are fixed by hand as they're discovered (the team curates the campus overlay directly).
- **Lost GPS mid-trip**: save partial trace as unverified, no points, no crash.
- **Search with no match**: no fuzzy suggestion fallback — user taps the map directly instead.
- **DDoS / abuse at the infra level**: handled by CDN/reverse proxy + rate limiting, not custom application logic.
- **Reward farming**: handled by path-adherence + speed-bound checks, smoothness flagging for review, and per-user daily caps (see Rewards system above).

## Testing approach

- Unit tests for the A* implementation on small synthetic graphs: correctness, mode filtering, time-weighting.
- Integration tests for the OSM-import + campus-overlay merge pipeline: does it produce a valid, connected graph.
- Manual/QA testing for GPS trip verification, since it depends on real device GPS behavior that's hard to fully simulate.

## Tech stack

- Backend: Node.js + TypeScript, Postgres.
- Web: React.
- Mobile: React Native.
- Map data: OpenStreetMap (country-wide extract via Overpass API or a regional `.pbf`), plus a hand-curated campus overlay.
