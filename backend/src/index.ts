import express from 'express';
import cors from 'cors';
import { routeRouter } from './routes/route.js';
import { authRouter } from './routes/auth.js';
import { tripsRouter } from './routes/trips.js';
import { placesRouter } from './routes/places.js';
import { redemptionsRouter } from './routes/redemptions.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { facultiesRouter } from './routes/faculties.js';

const app = express();

// The browser clients are served from their own origin, so every API call is
// cross-origin. Allow-list rather than reflect: this API issues bearer tokens,
// and an open CORS policy would let any page spend a signed-in user's points.
app.use(cors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(routeRouter);
app.use(authRouter);
app.use(tripsRouter);
app.use(placesRouter);
app.use(redemptionsRouter);
app.use(leaderboardRouter);
app.use(facultiesRouter);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`RouteFinder backend listening on port ${port}`);
});
