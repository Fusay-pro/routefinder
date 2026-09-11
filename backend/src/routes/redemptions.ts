import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  listActiveCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  redeemCatalogItem,
  listRedemptionsForUser,
  RedemptionError,
} from '../db/redemptionsRepo.js';

export const redemptionsRouter = Router();

// Public: browsing what points can be spent on doesn't require login.
redemptionsRouter.get('/redemptions/catalog', async (_req, res) => {
  try {
    const items = await listActiveCatalogItems();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list catalog' });
  }
});

// Admin-only: catalog items are curated, not user-submitted, in v1.
redemptionsRouter.post('/redemptions/catalog', requireAuth, requireAdmin, async (req, res) => {
  const { name, description, pointCost } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || typeof pointCost !== 'number' || pointCost <= 0) {
    res.status(400).json({ error: 'name (string) and pointCost (number > 0) are required' });
    return;
  }
  try {
    const item = await createCatalogItem({
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : null,
      pointCost,
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create catalog item' });
  }
});

redemptionsRouter.patch('/redemptions/catalog/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, description, pointCost, isActive } = req.body ?? {};
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    res.status(400).json({ error: 'name must be a non-empty string' });
    return;
  }
  if (pointCost !== undefined && (typeof pointCost !== 'number' || pointCost <= 0)) {
    res.status(400).json({ error: 'pointCost must be a number > 0' });
    return;
  }
  if (description !== undefined && typeof description !== 'string') {
    res.status(400).json({ error: 'description must be a string' });
    return;
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    res.status(400).json({ error: 'isActive must be a boolean' });
    return;
  }
  try {
    const item = await updateCatalogItem(req.params.id, {
      name: name?.trim(),
      description: description?.trim(),
      pointCost,
      isActive,
    });
    if (!item) {
      res.status(404).json({ error: 'Catalog item not found' });
      return;
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update catalog item' });
  }
});

const REDEMPTION_ERROR_STATUS: Record<string, number> = {
  catalog_item_not_found: 404,
  catalog_item_inactive: 409,
  insufficient_points: 402,
};

// Spend points on a catalog item. No fulfillment happens here — v1's items
// are placeholders (see idea/2026-09-11-v2-backlog.md); this only moves points.
redemptionsRouter.post('/redemptions', requireAuth, async (req, res) => {
  const { catalogItemId } = req.body ?? {};
  if (typeof catalogItemId !== 'string' || !catalogItemId) {
    res.status(400).json({ error: 'catalogItemId (string) is required' });
    return;
  }
  try {
    const result = await redeemCatalogItem(res.locals.userId as string, catalogItemId);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof RedemptionError) {
      res.status(REDEMPTION_ERROR_STATUS[err.code] ?? 400).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to redeem' });
  }
});

redemptionsRouter.get('/redemptions', requireAuth, async (req, res) => {
  try {
    const redemptions = await listRedemptionsForUser(res.locals.userId as string);
    res.json(redemptions);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list redemptions' });
  }
});
