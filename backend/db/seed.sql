-- ─────────────────────────────────────────────
-- faculties — the units the faculty leaderboard ranks
--
-- Thammasat Rangsit faculties. Users pick one at signup; adding or renaming one
-- later is safe, since users reference faculties by id. Safe to re-run.
-- ─────────────────────────────────────────────
INSERT INTO faculties (name, slug)
SELECT name, slug FROM (VALUES
    ('Engineering',                      'engineering'),
    ('SIIT',                             'siit'),
    ('Science and Technology',           'science-technology'),
    ('Medicine',                         'medicine'),
    ('Dentistry',                        'dentistry'),
    ('Nursing',                          'nursing'),
    ('Allied Health Sciences',           'allied-health-sciences'),
    ('Public Health',                    'public-health'),
    ('Law',                              'law'),
    ('Architecture and Planning',        'architecture-planning'),
    ('Journalism and Mass Communication','journalism'),
    ('Social Administration',            'social-administration'),
    ('Learning Sciences and Education',  'learning-sciences-education'),
    ('Sports Science',                   'sports-science')
) AS f(name, slug)
WHERE NOT EXISTS (SELECT 1 FROM faculties WHERE faculties.slug = f.slug);
