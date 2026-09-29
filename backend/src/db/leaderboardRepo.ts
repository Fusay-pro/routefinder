import { pool } from './pool.js';
import type { Mode } from '../graph/types.js';

export type BoardMetric = 'distance' | 'co2';
export type BoardActivity = 'foot' | 'cycle' | 'walk' | 'run' | 'bike';
export type BoardWindow = 'week' | 'month' | 'all';
export type FacultyRankBy = 'per_member' | 'total';

// User-supplied filters are never interpolated into SQL. Each one is looked up
// in a fixed map here, so the only strings reaching the query text are ours.
const METRIC_COLUMN: Record<BoardMetric, string> = {
  distance: 'scoring_distance_meters',
  co2: 'co2_saved_grams',
};

// Walking and running share a board: both are "on foot", and splitting them
// would leave two thin boards instead of one competitive one.
const ACTIVITY_MODES: Record<BoardActivity, Mode[]> = {
  foot: ['walk', 'run'],
  cycle: ['bike'],
  walk: ['walk'],
  run: ['run'],
  bike: ['bike'],
};

// date_trunc('week') is ISO — weeks start Monday. Both are evaluated in the
// database's timezone, which is the same one the daily caps use.
const WINDOW_START: Record<BoardWindow, string> = {
  week: "date_trunc('week', now())",
  month: "date_trunc('month', now())",
  all: "'-infinity'::timestamptz",
};

export interface BoardFilters {
  metric: BoardMetric;
  activity: BoardActivity;
  window: BoardWindow;
}

export interface IndividualRow {
  rank: number;
  userId: string;
  displayName: string | null;
  facultyName: string | null;
  facultySlug: string | null;
  value: number;
  tripCount: number;
}

export interface FacultyRow {
  rank: number;
  facultyId: string;
  name: string;
  slug: string;
  totalValue: number;
  valuePerMember: number;
  activeMembers: number;
  tripCount: number;
}

export interface MyStanding {
  /** Null when the caller has no scoring trips in this window — unranked, not last. */
  rank: number | null;
  value: number;
  tripCount: number;
  /** How many people have any scoring trip in this window, i.e. what rank is out of. */
  totalRanked: number;
}

// Only trips that actually scored are counted. A verified trip refused by the
// campus geofence or a daily cap awarded nothing, so it doesn't belong on a
// board either.
function whereClause(filters: BoardFilters): string {
  return `t.verification_status = 'verified'
      AND t.scoring_distance_meters > 0
      AND t.travel_mode = ANY($1::commute_mode[])
      AND t.started_at >= ${WINDOW_START[filters.window]}`;
}

function params(filters: BoardFilters): [Mode[]] {
  return [ACTIVITY_MODES[filters.activity]];
}

export async function individualBoard(filters: BoardFilters, limit: number): Promise<IndividualRow[]> {
  const metric = METRIC_COLUMN[filters.metric];
  const { rows } = await pool.query<{
    user_id: string;
    display_name: string | null;
    faculty_name: string | null;
    faculty_slug: string | null;
    value: number;
    trip_count: number;
    rank: string;
  }>(
    `SELECT u.id            AS user_id,
            u.display_name,
            f.name          AS faculty_name,
            f.slug          AS faculty_slug,
            sum(t.${metric})::double precision AS value,
            count(*)::int   AS trip_count,
            rank() OVER (ORDER BY sum(t.${metric}) DESC) AS rank
       FROM trips t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN faculties f ON f.id = u.faculty_id
      WHERE ${whereClause(filters)}
      GROUP BY u.id, u.display_name, f.name, f.slug
      ORDER BY value DESC
      LIMIT $2`,
    [...params(filters), limit]
  );

  return rows.map((row) => ({
    rank: Number(row.rank),
    userId: row.user_id,
    displayName: row.display_name,
    facultyName: row.faculty_name,
    facultySlug: row.faculty_slug,
    value: row.value,
    tripCount: row.trip_count,
  }));
}

// Ranked per active member by default, not on totals. On totals the largest
// faculty wins permanently and the board stops being worth looking at by week
// two. "Active member" means someone with a scoring trip in this window —
// counting enrolled-but-idle students would punish the big faculties just as
// arbitrarily in the other direction.
export async function facultyBoard(
  filters: BoardFilters,
  rankBy: FacultyRankBy,
  limit: number
): Promise<FacultyRow[]> {
  const metric = METRIC_COLUMN[filters.metric];
  const orderBy = rankBy === 'total' ? 'total_value' : 'value_per_member';
  const { rows } = await pool.query<{
    faculty_id: string;
    name: string;
    slug: string;
    total_value: number;
    value_per_member: number;
    active_members: number;
    trip_count: number;
    rank: string;
  }>(
    `SELECT f.id   AS faculty_id,
            f.name,
            f.slug,
            sum(t.${metric})::double precision                              AS total_value,
            (sum(t.${metric}) / count(DISTINCT t.user_id))::double precision AS value_per_member,
            count(DISTINCT t.user_id)::int                                  AS active_members,
            count(*)::int                                                   AS trip_count,
            rank() OVER (
              ORDER BY ${
                rankBy === 'total'
                  ? `sum(t.${metric})`
                  : `sum(t.${metric}) / count(DISTINCT t.user_id)`
              } DESC
            ) AS rank
       FROM trips t
       JOIN users u ON u.id = t.user_id
       JOIN faculties f ON f.id = u.faculty_id
      WHERE ${whereClause(filters)}
      GROUP BY f.id, f.name, f.slug
      ORDER BY ${orderBy} DESC
      LIMIT $2`,
    [...params(filters), limit]
  );

  return rows.map((row) => ({
    rank: Number(row.rank),
    facultyId: row.faculty_id,
    name: row.name,
    slug: row.slug,
    totalValue: row.total_value,
    valuePerMember: row.value_per_member,
    activeMembers: row.active_members,
    tripCount: row.trip_count,
  }));
}

// One query for "you're 42nd of 380", so the UI doesn't have to download the
// whole board to find the caller in it.
export async function myStanding(userId: string, filters: BoardFilters): Promise<MyStanding> {
  const metric = METRIC_COLUMN[filters.metric];
  const { rows } = await pool.query<{
    rank: string | null;
    value: number | null;
    trip_count: number | null;
    total_ranked: number;
  }>(
    `WITH totals AS (
       SELECT t.user_id,
              sum(t.${metric})::double precision AS value,
              count(*)::int AS trip_count
         FROM trips t
        WHERE ${whereClause(filters)}
        GROUP BY t.user_id
     ), ranked AS (
       SELECT user_id, value, trip_count, rank() OVER (ORDER BY value DESC) AS rank FROM totals
     )
     SELECT r.rank, r.value, r.trip_count, (SELECT count(*)::int FROM totals) AS total_ranked
       FROM (SELECT 1) AS always_one_row
       LEFT JOIN ranked r ON r.user_id = $2`,
    [...params(filters), userId]
  );

  const row = rows[0];
  return {
    rank: row?.rank == null ? null : Number(row.rank),
    value: row?.value ?? 0,
    tripCount: row?.trip_count ?? 0,
    totalRanked: row?.total_ranked ?? 0,
  };
}
