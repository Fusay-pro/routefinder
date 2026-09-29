# Frontend

React + TypeScript web client for the campus eco-commute competition. What the product is lives in
[`../idea/2026-09-29-eco-competition-vision.md`](../idea/2026-09-29-eco-competition-vision.md).
Screens are built from the design canvas (`../design/`), and the tokens in `tailwind.config.js` are
lifted from it — keep the two in step. The canvas predates the pivot, so the Leaderboard and Profile
screens have no artboard yet.

## Running it

```
npm install
npm run dev        # http://localhost:5173
```

The backend must be running and must allow this origin (`CORS_ORIGIN` in `../backend`). Configure
the rest with a `.env.local`:

```
VITE_API_URL=http://localhost:3100          # default http://localhost:3000
VITE_GOOGLE_MAPS_API_KEY=...                # Maps JavaScript API; without it the map is blank
VITE_GOOGLE_MAPS_MAP_ID=...                 # defaults to Google's DEMO_MAP_ID
```

The Maps key is baked into the bundle at build time and is visible to anyone who loads the page —
that's how browser keys work. Restrict it by HTTP referrer in Google Cloud rather than trying to
hide it. Everything except the map works without a key, so a missing one isn't a blocker for
development.

## Screens

| route | screen | reads |
|---|---|---|
| `/` | Go — full-bleed map, destination search, your week so far | `/places/search`, `/leaderboard/me` |
| `/leaderboard` | Boards: distance or CO₂, on foot or cycling, you or your faculty | `/leaderboard`, `/leaderboard/me` |
| `/routes` | Route options per travel mode | `/route` |
| `/trip` | Active trip, recording GPS | `/trips`, browser geolocation |
| `/complete` | Verification outcome, CO₂ avoided | `/trips/:id/complete` |
| `/activity` | Trip history | `/trips` |
| `/profile` | Faculty, change requests, points wallet | `/faculties`, `/faculty-change-requests/*` |
| `/rewards` | Balance and redemption catalog | `/redemptions/*`, `/auth/me` |

Signed-out users get the login/signup screen instead of any of the above.

## Things worth knowing

**Walk, run and bike load eagerly; car and motorcycle wait for a tap.** The three that score run on
the backend's own OSM graph and cost nothing. Car and motorcycle off-campus go to the Google Routes
API at $10–15 per 1000 requests, and earn nothing anyway, so fetching all five modes on every
destination change would bill real money for ETAs nobody asked for.

**The map is Google Maps, but routing isn't.** `MapView` draws on the Maps JavaScript SDK via
`@vis.gl/react-google-maps`, while every route still comes from our own campus graph — it has the
pedestrian shortcuts Google's data doesn't, and its path is what the backend checks a GPS trace
against. Destination search is `/places/search`, not Google Places, because campus nicknames are
exactly what Google doesn't have.

**The two boards are filters over one endpoint, but two shapes.** Individual and faculty rows have
genuinely different fields, so `Leaderboard.tsx` makes two typed calls and the inactive one resolves
without a request, rather than casting a union apart.

**A verified trip can still score nothing.** Trips have to start and finish on campus, be at least
250m apart end to end, and fall inside a daily cap. `TripComplete` says so explicitly when
`scoringDistanceMeters` is zero on a verified trip — otherwise a zero looks like a bug.

**The Simulate button on Active trip is dev-only** (`import.meta.env.DEV`). Browser geolocation on
a desktop returns one stationary fix, so a trip can never accumulate distance and verification is
untestable by hand. Simulate replays the suggested route, deriving each timestamp from the real
segment length at a per-mode speed — pacing it on a fixed tick instead produces an implausible
average speed and the backend rejects the trip.

## Not built yet

Admin screens (places, catalog, and the faculty-change review queue — the endpoints all exist),
Google Sign-In (`POST /auth/google` needs a real `GOOGLE_CLIENT_ID`; a Google-created account also
has no faculty until it calls `POST /faculties/me`), offline handling, and pagination.

Parking and weather were deleted outright with the pivot — client, endpoints, tables and all. The
design canvas in `../design/` still shows the parking sheet; it predates the pivot.
