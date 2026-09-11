-- Seeds the single pilot parking spot referenced in the design spec.
-- Safe to re-run: skips insert if a spot with this label already exists.
INSERT INTO parking_spots (label, lat, lng, status)
SELECT 'Pilot Spot 1', 13.7298, 100.7815, 'unknown'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE label = 'Pilot Spot 1');
