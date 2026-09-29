// Thammasat University Rangsit Center, from OSM (way 174967796).
const CAMPUS_BOUNDS = {
  minLat: 14.0656246,
  maxLat: 14.079894,
  minLng: 100.5928725,
  maxLng: 100.6174686,
};

export function isWithinCampus(lat: number, lng: number): boolean {
  return (
    lat >= CAMPUS_BOUNDS.minLat &&
    lat <= CAMPUS_BOUNDS.maxLat &&
    lng >= CAMPUS_BOUNDS.minLng &&
    lng <= CAMPUS_BOUNDS.maxLng
  );
}
