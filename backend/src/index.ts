import express from 'express';
import { routeRouter } from './routes/route.js';
import { parkingSpotsRouter } from './routes/parkingSpots.js';
import { authRouter } from './routes/auth.js';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(routeRouter);
app.use(parkingSpotsRouter);
app.use(authRouter);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`RouteFinder backend listening on port ${port}`);
});
