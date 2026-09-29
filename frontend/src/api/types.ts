export type Mode = 'walk' | 'bike' | 'motorcycle' | 'car';
export type TripStatus = 'in_progress' | 'completed' | 'abandoned';
export type VerificationStatus = 'unverified' | 'verified' | 'flagged_review' | 'rejected';
export type ParkingStatus = 'free' | 'occupied' | 'unknown';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
  pointsBalance: number;
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
  startedAt: string;
  endedAt: string | null;
}

export interface ParkingLotSummary {
  id: string;
  name: string;
  lat: number;
  lng: number;
  permitTier: string | null;
  totalSpots: number;
  freeSpots: number;
  occupiedSpots: number;
  unknownSpots: number;
  lastUpdated: string | null;
}

export interface ParkingSpot {
  id: string;
  label: string;
  level: string | null;
  lat: number;
  lng: number;
  status: ParkingStatus;
  lastUpdated: string;
}

export interface CurrentWeather {
  temperatureC: number;
  condition: string;
  description: string;
  isBikeFriendly: boolean;
  advice: string;
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
