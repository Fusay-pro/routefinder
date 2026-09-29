# Backend

Express + TypeScript API for the campus eco-commute competition. What the product is and why lives in [`idea/2026-09-29-eco-competition-vision.md`](../idea/2026-09-29-eco-competition-vision.md); how the routing engine, graph and verification work is still [`idea/2026-09-10-routefinder-design.md`](../idea/2026-09-10-routefinder-design.md); the data model lives in [`db/SCHEMA.md`](./db/SCHEMA.md). This file is the map of what's actually built.

## Running it

```
npm install
npm run db:migrate   # applies db/schema.sql to $DATABASE_URL
npm run db:seed       # seeds the faculty list
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
| `GOOGLE_ELEVATION_API_KEY` | for `npm run import:graph` only | not needed at runtime; pass `--skip-elevation` to import without it |
| `CORS_ORIGIN` | no | comma-separated allow-list of browser origins; defaults to `http://localhost:5173` |

Missing a required var doesn't crash the server at boot — the route that needs it fails cleanly at request time (e.g. `POST /auth/google` returns 401 "GOOGLE_CLIENT_ID is not configured" rather than 500 or a startup crash).

## Architecture

**Routing engine** ([`src/graph/`](./src/graph/), [`src/services/routingService.ts`](./src/services/routingService.ts)) — two sources, chosen per request:
- **Our own A\* graph** for walk/run/bike everywhere, and car/motorcycle when both endpoints are inside `CAMPUS_BOUNDS` ([`src/services/campus.ts`](./src/services/campus.ts)). The graph is Thammasat University Rangsit plus a ~3km buffer — as far as it's realistic to route someone on foot or by bike — built from OpenStreetMap by [`scripts/importOsmGraph.ts`](./scripts/importOsmGraph.ts) into [`src/graph/data/campusGraph.json`](./src/graph/data/campusGraph.json) (32k nodes / 65k directed edges, ~2MB, checked into the repo — not fetched at boot). Re-run `npm run import:graph` if the campus path network needs refreshing.
- **Google Routes API** ([`src/services/googleRoutes.ts`](./src/services/googleRoutes.ts)) for car/motorcycle once either endpoint is off-campus — that needs live traffic, which our graph doesn't have.

Running rides on the pedestrian network: rather than re-import the graph to add a `run` profile, [`loadGraph.ts`](./src/graph/loadGraph.ts) marks every walkable edge runnable at load time, at a fixed 9 km/h. Runners get the same paths as walkers and faster ETAs, and the checked-in graph file didn't have to change. Split it into a real importer profile if running ever needs different edges than walking.

`GraphNode`/`GraphEdge` live in [`src/graph/types.ts`](./src/graph/types.ts); the A\* implementation is a plain array-based open set (fine at this graph size — see the comment in `astar.ts` about swapping to a binary heap if the graph ever goes country-wide).

Own-graph routes also report `elevationGainMeters` / `elevationLossMeters`, summed from per-node elevations by `elevationDelta` in [`src/graph/geo.ts`](./src/graph/geo.ts). Elevation is **display-only** — A\*'s cost stays purely time-based. Node elevations are populated by the import script via the Google Elevation API and are optional: until `npm run import:graph` is re-run with `GOOGLE_ELEVATION_API_KEY` set, routes simply report zero gain/loss and nothing else changes.

**Auth** ([`src/services/authService.ts`](./src/services/authService.ts), [`src/routes/auth.ts`](./src/routes/auth.ts)) — email/password (bcrypt) or Google Sign-In (ID token verified server-side against `GOOGLE_CLIENT_ID`), both issuing the same JWT. Google sign-in links to an existing email account with the same address if one exists, otherwise creates a new user. `password_hash` and `google_id` are both nullable in `users` — exactly one must be set (DB `CHECK` constraint).

**Trips & verification** ([`src/routes/trips.ts`](./src/routes/trips.ts), [`src/services/tripVerification.ts`](./src/services/tripVerification.ts)) — starting a trip persists the suggested route so completing it can check the recorded GPS trace against three heuristics: path adherence (≥80% of points within 25m of the route line), plausible speed for the claimed mode, and a "suspiciously smooth" step-length check that flags (doesn't reject) traces too uniform to be a real GPS track. Outcomes: `verified` (awards points), `flagged_review`, `rejected`, or `unverified` (trace too short/missing — e.g. app closed mid-trip). These are hand-tuned heuristics, not ML — see the backlog doc for why a classifier is deferred until there's labeled data.

**Scoring** ([`src/services/scoringRules.ts`](./src/services/scoringRules.ts)) — verification and scoring answer two different questions, and are deliberately separate. `tripVerification` asks *does this trace look real*; `scoringRules` asks *is a real trip the kind the competition rewards*. A genuine 3km walk that starts off campus is verified and scores nothing. The rules: both endpoints inside `CAMPUS_BOUNDS`, origin and destination at least `MIN_TRIP_DISPLACEMENT_METERS` (250m) apart in a straight line, at most `DAILY_REWARD_TRIP_CAP` (5) scoring trips a day and `DAILY_SCORING_DISTANCE_METERS` (15km) of scoring distance. A trip that crosses the distance cap keeps the part under it rather than losing the whole trip for going long once.

The displacement floor is measured origin-to-destination, not along the route, and that's the point: it's what makes a lap worth nothing. Combined with path adherence — a trace has to follow a route from A to B — there's no way to farm by pacing in circles.

**Rewards and CO2** ([`src/services/rewardsService.ts`](./src/services/rewardsService.ts), [`src/services/co2Service.ts`](./src/services/co2Service.ts)) — flat points per km by mode (run 12, walk 10, bike 5, motorcycle/car 0; running pays more than walking because it's the same ground for more effort). CO2 avoided is `scoring_distance_meters` against `CAR_GRAMS_PER_KM` (170), the trip that didn't happen. Motorised modes save zero rather than something: a motorcycle does emit less than a car, but a board that pays people to ride motorcycles defeats the purpose, and a negative score would punish someone for logging a car trip honestly. Both are computed from the *scoring* distance, so the caps and geofence flow through to every number the user sees. Points are credited and the trip row updated in one transaction ([`completeTripAndAwardPoints`](./src/db/tripsRepo.ts)), now guarded by `WHERE status = 'in_progress'` so two concurrent completions can't both credit.

**Leaderboards** ([`src/db/leaderboardRepo.ts`](./src/db/leaderboardRepo.ts), [`src/routes/leaderboard.ts`](./src/routes/leaderboard.ts)) — the first cross-user queries in the codebase. Ranked individually or by faculty, on distance or CO2, over a week/month/all-time window, filtered to walking+running or cycling. Filter values are looked up in fixed maps rather than interpolated, so nothing user-supplied reaches the SQL text. Boards are signed-in only: they carry students' names, faculty and weekly movement, which isn't a roster to hand to anyone who finds the URL.

**Redemptions** ([`src/db/redemptionsRepo.ts`](./src/db/redemptionsRepo.ts), [`src/routes/redemptions.ts`](./src/routes/redemptions.ts)) — spend points on admin-curated catalog items. The deduction is a single guarded `UPDATE ... WHERE points_balance >= point_cost`, not a read-then-write, so it can't go negative under concurrent requests; it and the redemption insert happen in one transaction. No fulfillment mechanism yet — v1 catalog items are placeholders (real merchant integration is in the v2 backlog).

**Places** ([`src/db/placesRepo.ts`](./src/db/placesRepo.ts)) — campus buildings/POIs with admin-curated aliases (the informal names students actually use), matched case-insensitively. No fuzzy matching — if nothing matches, the client falls back to the user tapping the map.

**Faculties** ([`src/db/facultiesRepo.ts`](./src/db/facultiesRepo.ts), [`src/routes/faculties.ts`](./src/routes/faculties.ts)) — users pick a faculty at signup and can't reassign themselves afterwards; moving is a request an admin approves, since a contest between groups shouldn't let people pile onto whichever one is winning. Approval and the user's move happen in one transaction, guarded on `status = 'pending'` so a double-approval is a no-op rather than a second move.

## API reference

All bodies/responses are JSON. Authenticated routes take `Authorization: Bearer <token>`; admin routes additionally require the caller's `users.role = 'admin'`.

| method & path | auth | purpose |
|---|---|---|
| `GET /health` | — | liveness check |
| `POST /route` | — | one-off route computation (no trip persisted) |
| `POST /auth/signup` | — | email + password (min 8 chars) |
| `POST /auth/login` | — | email + password |
| `POST /auth/google` | — | `{ idToken }` from Google Sign-In |
| `GET /auth/me` | user | current user profile, faculty and points balance |
| `GET /leaderboard` | user | ranked board; see filters below |
| `GET /leaderboard/me` | user | caller's own rank under the same filters |
| `GET /faculties` | — | the faculty list, for the signup picker |
| `POST /faculties/me` | user | set a faculty when the account has none (Google sign-ups) |
| `POST /faculty-change-requests` | user | ask to move faculty, with a note |
| `GET /faculty-change-requests/me` | user | caller's own pending request |
| `GET /faculty-change-requests?status=` | admin | review queue |
| `PATCH /faculty-change-requests/:id` | admin | `{ decision: 'approved' \| 'rejected' }` |
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

### Leaderboard filters

`GET /leaderboard` takes `metric`, `activity`, `window`, `scope`, `rankBy` and `limit`. Unrecognised
values fall back to the default rather than erroring, so a stale client degrades instead of breaking.

| param | values | default |
|---|---|---|
| `metric` | `distance`, `co2` | `distance` |
| `activity` | `foot` (walk + run), `cycle`, `walk`, `run`, `bike` | `foot` |
| `window` | `week`, `month`, `all` | `week` |
| `scope` | `individual`, `faculty` | `individual` |
| `rankBy` | `per_member`, `total` (faculty scope only) | `per_member` |
| `limit` | 1–200 | 50 |

The faculty board defaults to **per active member, not total**. On totals the largest faculty wins
permanently and the board is worth nothing by week two. "Active member" means someone with a scoring
trip inside the window — counting enrolled-but-idle students would punish the big faculties just as
arbitrarily in the other direction.

Only trips that actually *scored* appear. A verified trip refused by the geofence or a daily cap
awarded nothing, so it doesn't belong on a board either.

## Known gaps (not bugs, just not built yet)

- **CORS is an allow-list, not a reflector** — `CORS_ORIGIN` (comma-separated, defaults to `http://localhost:5173`) must name every origin the browser clients are served from. Deliberately not `origin: true`: this API hands out bearer tokens, so reflecting any origin would let a hostile page spend a signed-in user's points.
- **Own-graph routing is scoped to campus + ~3km** — intentional (see Architecture above), but means walk/bike routing beyond that radius will fail to find a path rather than falling back to Google.
- **Reward verification trusts a client-supplied GPS trace** — the adherence/speed/smoothness heuristics in `tripVerification.ts` catch naive spoofing, but a scripted client fabricating a plausible trace could still farm points (bounded by the daily trip cap). Real mitigation is device attestation or live server-side location pings, not a quick fix — see the ML section of the v2 backlog for the data-collection angle on this.
- **Elevation needs a graph re-import to appear** — the plumbing ships with elevations absent, reporting zeros, until `npm run import:graph` runs with an elevation key.
- **`flagged_review` still has no resolution path** — a trip flagged as a suspicious trace stays flagged forever; there's no admin queue and no way to promote one to `verified` and retro-credit it. This mattered less when points were private. Now a wrongly-flagged trip costs someone a place on a board.
- **The daily caps use the database's timezone**, not the user's, and bucket on `started_at` — so a trip begun before midnight counts against the day it started.
- **Nearest-node snapping has no distance cutoff** — a point hundreds of kilometres away silently snaps to the nearest campus node. Harmless now that the geofence refuses to score such trips, but it means the router will happily return a route for coordinates it shouldn't.
- Everything else deferred (bike-share, real merchant redemption, social graph, multiple universities, ML) is tracked in [`idea/2026-09-11-v2-backlog.md`](../idea/2026-09-11-v2-backlog.md).
