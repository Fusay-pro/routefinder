import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { searchPlaces, createPlace, addPlaceAlias } from '../db/placesRepo.js';

export const placesRouter = Router();

// Public: matches canonical_name or any alias. No fuzzy "did you mean" —
// if nothing matches, the client falls back to letting the user tap the map.
placesRouter.get('/places/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'q query parameter is required' });
    return;
  }
  try {
    const results = await searchPlaces(q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Search failed' });
  }
});

// Admin-only: places/aliases are curated, not crowdsourced, in v1.
placesRouter.post('/places', requireAuth, requireAdmin, async (req, res) => {
  const { canonicalName, lat, lng } = req.body ?? {};
  if (typeof canonicalName !== 'string' || !canonicalName.trim() || typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'canonicalName (string), lat and lng (numbers) are required' });
    return;
  }
  try {
    const place = await createPlace({ canonicalName: canonicalName.trim(), lat, lng });
    res.status(201).json(place);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create place' });
  }
});

placesRouter.post('/places/:id/aliases', requireAuth, requireAdmin, async (req, res) => {
  const { alias } = req.body ?? {};
  if (typeof alias !== 'string' || !alias.trim()) {
    res.status(400).json({ error: 'alias (string) is required' });
    return;
  }
  try {
    await addPlaceAlias(req.params.id, alias.trim(), res.locals.userId as string);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add alias' });
  }
});
