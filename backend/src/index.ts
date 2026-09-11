import express from 'express';
import { routeRouter } from './routes/route.js';
import { parkingSpotsRouter } from './routes/parkingSpots.js';
import { authRouter } from './routes/auth.js';
import { tripsRouter } from './routes/trips.js';
import { placesRouter } from './routes/places.js';
import { redemptionsRouter } from './routes/redemptions.js';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(routeRouter);
app.use(parkingSpotsRouter);
app.use(authRouter);
app.use(tripsRouter);
app.use(placesRouter);
app.use(redemptionsRouter);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`RouteFinder backend listening on port ${port}`);
});
