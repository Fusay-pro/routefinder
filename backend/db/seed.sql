-- Seeds the pilot parking lot and its spots, per the design spec.
-- Safe to re-run: every insert skips if the row already exists.

INSERT INTO parking_lots (name, lat, lng, permit_tier)
SELECT 'Pilot Lot', 13.7298, 100.7815, NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_lots WHERE name = 'Pilot Lot');

-- The original pilot spot, now attached to the lot above.
INSERT INTO parking_spots (lot_id, label, level, lat, lng, status)
SELECT (SELECT id FROM parking_lots WHERE name = 'Pilot Lot'), 'Pilot Spot 1', 'L1', 13.7298, 100.7815, 'unknown'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE label = 'Pilot Spot 1');

UPDATE parking_spots
SET lot_id = (SELECT id FROM parking_lots WHERE name = 'Pilot Lot'), level = COALESCE(level, 'L1')
WHERE label = 'Pilot Spot 1' AND lot_id IS NULL;

-- A handful of sensor-less spots across two levels, so the lot-level aggregate
-- has something to count in a demo. These read as `unknown` until a sensor (or
-- the manual test script) posts a status for them.
INSERT INTO parking_spots (lot_id, label, level, lat, lng, status)
SELECT (SELECT id FROM parking_lots WHERE name = 'Pilot Lot'), label, level, lat, lng, 'unknown'
FROM (VALUES
    ('Pilot Spot 2', 'L1', 13.72982, 100.78152),
    ('Pilot Spot 3', 'L1', 13.72984, 100.78154),
    ('Pilot Spot 4', 'L2', 13.72986, 100.78156),
    ('Pilot Spot 5', 'L2', 13.72988, 100.78158)
) AS s(label, level, lat, lng)
WHERE NOT EXISTS (SELECT 1 FROM parking_spots p WHERE p.label = s.label);
