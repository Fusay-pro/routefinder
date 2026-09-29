-- Optional demo data, so a fresh `docker compose up` has something to show:
-- searchable buildings and a redemption catalog. Everything sits inside
-- CAMPUS_BOUNDS (services/campus.ts) so routing stays on our own graph.
--
-- Not loaded by `npm run db:seed` — that stays the faculty seed. This is
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
