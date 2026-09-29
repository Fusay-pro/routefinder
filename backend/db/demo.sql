-- Optional demo data, so a fresh `docker compose up` has something to show:
-- searchable buildings, a redemption catalog, and a parking lot exercising all
-- three spot states. Everything sits inside CAMPUS_BOUNDS (services/campus.ts)
-- so routing stays on our own graph.
--
-- Not loaded by `npm run db:seed` — that stays the real pilot seed. This is
-- mounted into the Postgres container's init directory by docker-compose.yml.
-- Safe to re-run.

INSERT INTO places (canonical_name, lat, lng)
SELECT name, lat, lng FROM (VALUES
    ('SC Building',    14.0705, 100.6065),
    ('Main Library',   14.0742, 100.6042),
    ('Student Union',  14.0688, 100.6011),
    ('Engineering 4',  14.0760, 100.6098),
    ('Sports Complex', 14.0670, 100.6080)
) AS p(name, lat, lng)
WHERE NOT EXISTS (SELECT 1 FROM places WHERE canonical_name = p.name);

-- The informal names students actually search for.
INSERT INTO place_aliases (place_id, alias)
SELECT pl.id, a.alias FROM (VALUES
    ('SC Building',    'SC'),
    ('Main Library',   'The Library'),
    ('Student Union',  'Union'),
    ('Engineering 4',  'Eng 4'),
    ('Sports Complex', 'The Gym')
) AS a(place_name, alias)
JOIN places pl ON pl.canonical_name = a.place_name
ON CONFLICT (place_id, alias) DO NOTHING;

INSERT INTO redemption_catalog (name, description, point_cost)
SELECT name, description, cost FROM (VALUES
    ('Free coffee',         'Campus canteen',       150),
    ('100 pages printing',  'Library print credit', 200),
    ('Library fine waiver', 'Up to 100 baht',       400),
    ('Canteen voucher',     '50 baht',              600)
) AS c(name, description, cost)
WHERE NOT EXISTS (SELECT 1 FROM redemption_catalog WHERE redemption_catalog.name = c.name);

INSERT INTO parking_lots (name, lat, lng, permit_tier)
SELECT 'North Lot', 14.0712, 100.6030, 'A'
WHERE NOT EXISTS (SELECT 1 FROM parking_lots WHERE name = 'North Lot');

-- Deliberately mixed: some spots reporting free, some occupied, some with no
-- sensor at all, and one whose sensor went quiet hours ago. The last two are
-- the cases the UI has to keep distinct from "full".
INSERT INTO parking_spots (lot_id, label, level, lat, lng, status, last_updated)
SELECT (SELECT id FROM parking_lots WHERE name = 'North Lot'), s.label, s.level, s.lat, s.lng,
       s.status::parking_status, now() - make_interval(mins => s.age_mins)
FROM (VALUES
    ('North A1', 'L1', 14.07120, 100.60300, 'free',     2),
    ('North A2', 'L1', 14.07122, 100.60302, 'free',     2),
    ('North A3', 'L1', 14.07124, 100.60304, 'occupied', 3),
    ('North A4', 'L1', 14.07126, 100.60306, 'occupied', 1),
    ('North B1', 'L2', 14.07128, 100.60308, 'free',   180),  -- sensor gone quiet
    ('North B2', 'L2', 14.07130, 100.60310, 'unknown',  5),  -- no sensor fitted
    ('North B3', 'L2', 14.07132, 100.60312, 'unknown',  5)
) AS s(label, level, lat, lng, status, age_mins)
WHERE NOT EXISTS (SELECT 1 FROM parking_spots p WHERE p.label = s.label);
