# RouteFinder Backend

Express + TypeScript API for RouteFinder v1. Background/rationale lives in [`idea/2026-09-10-routefinder-design.md`](../idea/2026-09-10-routefinder-design.md) and [`idea/2026-09-11-v2-backlog.md`](../idea/2026-09-11-v2-backlog.md); the data model lives in [`db/SCHEMA.md`](./db/SCHEMA.md). This file is the map of what's actually built.

## Running it

```
npm install
npm run db:migrate   # applies db/schema.sql to $DATABASE_URL
npm run db:seed       # seeds the pilot parking spot
npm run dev            # tsx watch, no build step
```

`npm run build && npm start` for a production-style run (compiles to `dist/`, copies the graph data file alongside it).

### Environment variables (see `.env.example`)

| var | required | notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `PORT` | no | defaults to 3000 |
| `JWT_SECRET` | yes, for any auth route | signs/verifies session tokens |
| `GOOGLE_CLIENT_ID` | for `/auth/google` | must match the OAuth client the frontend uses |
| `GOOGLE_ROUTES_API_KEY` | for off-campus car/motorcycle routing | Advanced tier for car, Preferred tier for motorcycle (two-wheeler) |
| `SENSOR_API_KEY` | for parking status updates | shared key, fine for the one-sensor pilot |

Missing a required var doesn't crash the server at boot — the route that needs it fails cleanly at request time (e.g. `POST /auth/google` returns 401 "GOOGLE_CLIENT_ID is not configured" rather than 500 or a startup crash).

## Architecture

**Routing engine** ([`src/graph/`](./src/graph/), [`src/services/routingService.ts`](./src/services/routingService.ts)) — two sources, chosen per request:
- **Our own A\* graph** for walk/bike everywhere, and car/motorcycle when both endpoints are inside `CAMPUS_BOUNDS` ([`src/services/campus.ts`](./src/services/campus.ts)). The graph is Thammasat University Rangsit plus a ~3km buffer — as far as it's realistic to route someone on foot or by bike — built from OpenStreetMap by [`scripts/importOsmGraph.ts`](./scripts/importOsmGraph.ts) into [`src/graph/data/campusGraph.json`](./src/graph/data/campusGraph.json) (32k nodes / 65k directed edges, ~2MB, checked into the repo — not fetched at boot). Re-run `npm run import:graph` if the campus path network needs refreshing.
- **Google Routes API** ([`src/services/googleRoutes.ts`](./src/services/googleRoutes.ts)) for car/motorcycle once either endpoint is off-campus — that needs live traffic, which our graph doesn't have.

`GraphNode`/`GraphEdge` live in [`src/graph/types.ts`](./src/graph/types.ts); the A\* implementation is a plain array-based open set (fine at this graph size — see the comment in `astar.ts` about swapping to a binary heap if the graph ever goes country-wide).

**Auth** ([`src/services/authService.ts`](./src/services/authService.ts), [`src/routes/auth.ts`](./src/routes/auth.ts)) — email/password (bcrypt) or Google Sign-In (ID token verified server-side against `GOOGLE_CLIENT_ID`), both issuing the same JWT. Google sign-in links to an existing email account with the same address if one exists, otherwise creates a new user. `password_hash` and `google_id` are both nullable in `users` — exactly one must be set (DB `CHECK` constraint).

**Trips & verification** ([`src/routes/trips.ts`](./src/routes/trips.ts), [`src/services/tripVerification.ts`](./src/services/tripVerification.ts)) — starting a trip persists the suggested route so completing it can check the recorded GPS trace against three heuristics: path adherence (≥80% of points within 25m of the route line), plausible speed for the claimed mode, and a "suspiciously smooth" step-length check that flags (doesn't reject) traces too uniform to be a real GPS track. Outcomes: `verified` (awards points), `flagged_review`, `rejected`, or `unverified` (trace too short/missing — e.g. app closed mid-trip). These are hand-tuned heuristics, not ML — see the backlog doc for why a classifier is deferred until there's labeled data.

**Rewards** ([`src/services/rewardsService.ts`](./src/services/rewardsService.ts)) — flat points per km by mode (walk 10, bike 5, motorcycle/car 0 — the whole point is nudging people away from vehicles), capped at 5 verified trips/day per user to bound farming. Points are credited and the trip row updated in one transaction ([`completeTripAndAwardPoints`](./src/db/tripsRepo.ts)).

**Redemptions** ([`src/db/redemptionsRepo.ts`](./src/db/redemptionsRepo.ts), [`src/routes/redemptions.ts`](./src/routes/redemptions.ts)) — spend points on admin-curated catalog items. The deduction is a single guarded `UPDATE ... WHERE points_balance >= point_cost`, not a read-then-write, so it can't go negative under concurrent requests; it and the redemption insert happen in one transaction. No fulfillment mechanism yet — v1 catalog items are placeholders (real merchant integration is in the v2 backlog).

**Places** ([`src/db/placesRepo.ts`](./src/db/placesRepo.ts)) — campus buildings/POIs with admin-curated aliases (the informal names students actually use), matched case-insensitively. No fuzzy matching — if nothing matches, the client falls back to the user tapping the map.

**Parking** ([`src/db/parkingSpotsRepo.ts`](./src/db/parkingSpotsRepo.ts)) — one-spot pilot proving the sensor → backend → map pipeline; `POST /parking-spots/:id/status` is authenticated by a shared `SENSOR_API_KEY` rather than a user JWT, since the caller is a sensor, not a person.

## API reference

All bodies/responses are JSON. Authenticated routes take `Authorization: Bearer <token>`; admin routes additionally require the caller's `users.role = 'admin'`.

| method & path | auth | purpose |
|---|---|---|
| `GET /health` | — | liveness check |
| `POST /route` | — | one-off route computation (no trip persisted) |
| `POST /auth/signup` | — | email + password (min 8 chars) |
| `POST /auth/login` | — | email + password |
| `POST /auth/google` | — | `{ idToken }` from Google Sign-In |
| `GET /auth/me` | user | current user profile + points balance |
| `POST /trips` | user | compute + persist a route, starting a trip |
| `GET /trips` | user | caller's trip history |
| `POST /trips/:id/complete` | user | submit GPS trace, triggers verification + points |
| `GET /places/search?q=` | — | match canonical name or alias |
| `POST /places` | admin | create a place |
| `POST /places/:id/aliases` | admin | add a nickname to a place |
| `GET /redemptions/catalog` | — | active catalog items |
| `POST /redemptions/catalog` | admin | create a catalog item |
| `PATCH /redemptions/catalog/:id` | admin | edit / activate / deactivate an item |
| `POST /redemptions` | user | spend points on `{ catalogItemId }` |
| `GET /redemptions` | user | caller's redemption history |
| `GET /parking-spots` | — | current status of all pilot spots |
| `POST /parking-spots/:id/status` | sensor key | sensor posts a status update |

## Known gaps (not bugs, just not built yet)

- **No CORS middleware** — fine for curl/server-to-server today, will need `cors` once a browser frontend calls this cross-origin.
- **No frontend** — nothing in this repo renders any of this yet; see the v2 backlog and design doc for the planned React web + React Native mobile clients.
- **Own-graph routing is scoped to campus + ~3km** — intentional (see Architecture above), but means walk/bike routing beyond that radius will fail to find a path rather than falling back to Google.
- Everything else deferred out of v1 (motorcycle-taxi matching, public bike queue, full parking rollout, real merchant redemption, ML) is tracked in [`idea/2026-09-11-v2-backlog.md`](../idea/2026-09-11-v2-backlog.md).
