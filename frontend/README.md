# RouteFinder Frontend

React + TypeScript web client for the RouteFinder API. Screens are built from the design canvas
(`../design/`), and the tokens in `tailwind.config.js` are lifted from it — keep the two in step.

## Running it

```
npm install
npm run dev        # http://localhost:5173
```

The backend must be running and must allow this origin (`CORS_ORIGIN` in `../backend`). Point the
client somewhere other than `http://localhost:3000` with a `.env.local`:

```
VITE_API_URL=http://localhost:3100
```

## Screens

| route | screen | reads |
|---|---|---|
| `/` | Explore — full-bleed map, search, parking sheet | `/places/search`, `/parking-lots`, `/weather` |
| `/routes` | Route options per travel mode | `/route` |
| `/trip` | Active trip, recording GPS | `/trips`, browser geolocation |
| `/complete` | Verification outcome + points | `/trips/:id/complete` |
| `/rewards` | Balance and redemption catalog | `/redemptions/*`, `/auth/me` |
| `/activity` | Trip history | `/trips` |

Signed-out users get the login/signup screen instead of any of the above.

## Things worth knowing

**Walk and bike routes load eagerly; car and motorcycle wait for a tap.** Walk and bike run on the
backend's own OSM graph and cost nothing. Car and motorcycle off-campus go to the Google Routes
API at $10–15 per 1000 requests, so fetching all four modes on every destination change would bill
real money for ETAs nobody asked for.

**Parking has three states, not two.** `unknownSpots` renders hatched and never reads as "full" —
a lot with no sensors reporting is a different thing from a lot that's genuinely full. The
backend already folds stale sensors (quiet > 15 min) into `unknown`, so the client just renders
what it gets.

**The Simulate button on Active trip is dev-only** (`import.meta.env.DEV`). Browser geolocation on
a desktop returns one stationary fix, so a trip can never accumulate distance and verification is
untestable by hand. Simulate replays the suggested route, deriving each timestamp from the real
segment length at a per-mode speed — pacing it on a fixed tick instead produces an implausible
average speed and the backend rejects the trip.

## Not built yet

Admin screens (places, parking lots, catalog — the endpoints exist), Google Sign-In
(`POST /auth/google` needs a real `GOOGLE_CLIENT_ID`), offline handling, and pagination.
