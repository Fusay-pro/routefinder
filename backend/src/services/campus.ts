// TODO: replace with your actual university's bounding box.
const CAMPUS_BOUNDS = {
  minLat: 13.725,
  maxLat: 13.735,
  minLng: 100.775,
  maxLng: 100.785,
};

export function isWithinCampus(lat: number, lng: number): boolean {
  return (
    lat >= CAMPUS_BOUNDS.minLat &&
    lat <= CAMPUS_BOUNDS.maxLat &&
    lng >= CAMPUS_BOUNDS.minLng &&
    lng <= CAMPUS_BOUNDS.maxLng
  );
}
