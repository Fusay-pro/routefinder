export type Mode = 'walk' | 'run' | 'bike' | 'motorcycle' | 'car';
export type TripStatus = 'in_progress' | 'completed' | 'abandoned';
export type VerificationStatus = 'unverified' | 'verified' | 'flagged_review' | 'rejected';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
  pointsBalance: number;
  facultyId: string | null;
}

export interface Faculty {
  id: string;
  name: string;
  slug: string;
}

export type FacultyChangeStatus = 'pending' | 'approved' | 'rejected';

export interface FacultyChangeRequest {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string | null;
  currentFacultyName: string | null;
  requestedFacultyId: string;
  requestedFacultyName: string;
  note: string | null;
  status: FacultyChangeStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AuthResult {
  user: User;
  token: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  source: 'own-graph' | 'google';
  distanceMeters: number;
  seconds: number;
  path?: LatLng[];
  polyline?: string;
  elevationGainMeters?: number;
  elevationLossMeters?: number;
  estimatedPoints: number;
}

export interface Place {
  id: string;
  canonicalName: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export interface Trip {
  id: string;
  userId: string;
  travelMode: Mode;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  suggestedRoute: RouteResult | null;
  distanceMeters: number;
  estimatedSeconds: number;
  status: TripStatus;
  verificationStatus: VerificationStatus;
  pointsAwarded: number;
  // What actually happened, from the GPS trace. Null until the trip completes
  // with a usable trace — distanceMeters above is what was *planned*.
  actualDistanceMeters: number | null;
  actualDurationSeconds: number | null;
  // The part of actualDistanceMeters that counted, after the campus geofence
  // and daily caps. Zero on a trip that verified but didn't qualify.
  scoringDistanceMeters: number | null;
  co2SavedGrams: number | null;
  startedAt: string;
  endedAt: string | null;
}

export type BoardMetric = 'distance' | 'co2';
export type BoardActivity = 'foot' | 'cycle';
export type BoardWindow = 'week' | 'month' | 'all';
export type BoardScope = 'individual' | 'faculty';

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

export interface BoardResponse<Row> {
  scope: BoardScope;
  metric: BoardMetric;
  activity: BoardActivity;
  window: BoardWindow;
  rankBy?: 'per_member' | 'total';
  rows: Row[];
}

export interface MyStanding {
  metric: BoardMetric;
  activity: BoardActivity;
  window: BoardWindow;
  /** Null when you have no scoring trips in this window — unranked, not last. */
  rank: number | null;
  value: number;
  tripCount: number;
  totalRanked: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  pointCost: number;
  isActive: boolean;
}

export interface Redemption {
  id: string;
  catalogItemId: string;
  catalogItemName: string;
  pointsSpent: number;
  redeemedAt: string;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  t: string;
}
