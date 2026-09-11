import { pool } from './pool.js';

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  pointCost: number;
  isActive: boolean;
}

interface CatalogItemRow {
  id: string;
  name: string;
  description: string | null;
  point_cost: number;
  is_active: boolean;
}

function toCatalogItem(row: CatalogItemRow): CatalogItem {
  return { id: row.id, name: row.name, description: row.description, pointCost: row.point_cost, isActive: row.is_active };
}

export async function listActiveCatalogItems(): Promise<CatalogItem[]> {
  const { rows } = await pool.query<CatalogItemRow>(
    'SELECT id, name, description, point_cost, is_active FROM redemption_catalog WHERE is_active = true ORDER BY point_cost'
  );
  return rows.map(toCatalogItem);
}

export interface CreateCatalogItemInput {
  name: string;
  description: string | null;
  pointCost: number;
}

export async function createCatalogItem(input: CreateCatalogItemInput): Promise<CatalogItem> {
  const { rows } = await pool.query<CatalogItemRow>(
    `INSERT INTO redemption_catalog (name, description, point_cost) VALUES ($1, $2, $3)
     RETURNING id, name, description, point_cost, is_active`,
    [input.name, input.description, input.pointCost]
  );
  return toCatalogItem(rows[0]);
}

export interface UpdateCatalogItemInput {
  name?: string;
  description?: string | null;
  pointCost?: number;
  isActive?: boolean;
}

export async function updateCatalogItem(id: string, input: UpdateCatalogItemInput): Promise<CatalogItem | null> {
  const { rows } = await pool.query<CatalogItemRow>(
    `UPDATE redemption_catalog SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       point_cost = COALESCE($3, point_cost),
       is_active = COALESCE($4, is_active),
       updated_at = now()
     WHERE id = $5
     RETURNING id, name, description, point_cost, is_active`,
    [input.name ?? null, input.description ?? null, input.pointCost ?? null, input.isActive ?? null, id]
  );
  return rows[0] ? toCatalogItem(rows[0]) : null;
}

export interface Redemption {
  id: string;
  userId: string;
  catalogItemId: string;
  pointsSpent: number;
  redeemedAt: string;
}

interface RedemptionRow {
  id: string;
  user_id: string;
  catalog_item_id: string;
  points_spent: number;
  redeemed_at: string;
}

function toRedemption(row: RedemptionRow): Redemption {
  return {
    id: row.id,
    userId: row.user_id,
    catalogItemId: row.catalog_item_id,
    pointsSpent: row.points_spent,
    redeemedAt: row.redeemed_at,
  };
}

export type RedemptionErrorCode = 'catalog_item_not_found' | 'catalog_item_inactive' | 'insufficient_points';

export class RedemptionError extends Error {
  constructor(public code: RedemptionErrorCode) {
    super(code);
  }
}

// Redeeming and deducting points happen in one transaction, same reasoning as
// completeTripAndAwardPoints: never let points leave the balance without a
// redemption row, or vice versa. The deduction is a single guarded UPDATE
// (points_balance >= point_cost in the WHERE clause) rather than a
// read-then-write, so two concurrent redemptions can't both pass a balance
// check that only one of them should — the second simply matches 0 rows.
export async function redeemCatalogItem(userId: string, catalogItemId: string): Promise<{ redemption: Redemption; pointsBalance: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: itemRows } = await client.query<{ point_cost: number; is_active: boolean }>(
      'SELECT point_cost, is_active FROM redemption_catalog WHERE id = $1',
      [catalogItemId]
    );
    const item = itemRows[0];
    if (!item) throw new RedemptionError('catalog_item_not_found');
    if (!item.is_active) throw new RedemptionError('catalog_item_inactive');

    const { rows: userRows } = await client.query<{ points_balance: number }>(
      'UPDATE users SET points_balance = points_balance - $1, updated_at = now() WHERE id = $2 AND points_balance >= $1 RETURNING points_balance',
      [item.point_cost, userId]
    );
    if (!userRows[0]) throw new RedemptionError('insufficient_points');

    const { rows: redemptionRows } = await client.query<RedemptionRow>(
      `INSERT INTO redemptions (user_id, catalog_item_id, points_spent) VALUES ($1, $2, $3)
       RETURNING id, user_id, catalog_item_id, points_spent, redeemed_at`,
      [userId, catalogItemId, item.point_cost]
    );

    await client.query('COMMIT');
    return { redemption: toRedemption(redemptionRows[0]), pointsBalance: userRows[0].points_balance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface RedemptionWithItem extends Redemption {
  catalogItemName: string;
}

export async function listRedemptionsForUser(userId: string): Promise<RedemptionWithItem[]> {
  const { rows } = await pool.query<RedemptionRow & { catalog_item_name: string }>(
    `SELECT r.id, r.user_id, r.catalog_item_id, r.points_spent, r.redeemed_at, c.name AS catalog_item_name
     FROM redemptions r
     JOIN redemption_catalog c ON c.id = r.catalog_item_id
     WHERE r.user_id = $1
     ORDER BY r.redeemed_at DESC`,
    [userId]
  );
  return rows.map((row) => ({ ...toRedemption(row), catalogItemName: row.catalog_item_name }));
}
