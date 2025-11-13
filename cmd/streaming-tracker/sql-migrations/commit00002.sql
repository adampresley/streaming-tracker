--
-- platform aliases
--
CREATE TABLE IF NOT EXISTS "platform_aliases" (
   id serial PRIMARY KEY,
   platform_id integer REFERENCES platforms(id) NOT NULL,
   external_name text NOT NULL,
   source text NOT NULL DEFAULT 'tvmaze'
);

CREATE INDEX IF NOT EXISTS idx_platform_aliases_external_name_source ON platform_aliases (external_name, source);

INSERT INTO platforms (created_at, updated_at, name, icon) VALUES
   (now(), now(), 'Starz', 'starz')
;

INSERT INTO platform_aliases (platform_id, external_name, source) VALUES
   -- Netflix variations
   (1, 'netflix', 'tvmaze'),

   -- Hulu variations
   (2, 'hulu', 'tvmaze'),

   -- Disney+ variations
   (3, 'disney+', 'tvmaze'),
   (3, 'disney plus', 'tvmaze'),
   (3, 'disneyplus', 'tvmaze'),

   -- Amazon Prime variations
   (4, 'amazon prime', 'tvmaze'),
   (4, 'amazon prime video', 'tvmaze'),
   (4, 'prime video', 'tvmaze'),
   (4, 'amazon video', 'tvmaze'),

   -- HBO Max variations
   (5, 'hbo max', 'tvmaze'),
   (5, 'hbo go', 'tvmaze'),
   (5, 'hbo now', 'tvmaze'),
   (5, 'max', 'tvmaze'),
   (5, 'hbo', 'tvmaze'),

   -- Apple TV+ variations
   (6, 'apple tv', 'tvmaze'),
   (6, 'apple tv+', 'tvmaze'),
   (6, 'appletv+', 'tvmaze'),
   (6, 'appletv', 'tvmaze'),
   (6, 'apple tv plus', 'tvmaze'),
   (6, 'apple television', 'tvmaze'),

   -- Paramount+ variations
   (7, 'paramount', 'tvmaze'),
   (7, 'paramount+', 'tvmaze'),
   (7, 'paramount plus', 'tvmaze'),
   (7, 'paramountplus', 'tvmaze'),
   (7, 'cbs all access', 'tvmaze'),

   -- Peacock variations
   (8, 'peacock', 'tvmaze'),
   (8, 'peacock tv', 'tvmaze'),
   (8, 'nbc peacock', 'tvmaze'),

   -- AMC+ variations
   (9, 'amc+', 'tvmaze'),
   (9, 'amc plus', 'tvmaze'),
   (9, 'amcplus', 'tvmaze'),

   -- Acorn TV variations
   (10, 'acorn tv', 'tvmaze'),
   (10, 'acorn', 'tvmaze'),

   -- BritBox variations
   (11, 'britbox', 'tvmaze'),
   (11, 'bbc iplayer', 'tvmaze'),

   -- Crunchyroll variations
   (12, 'cruncyroll', 'tvmaze'),
   (12, 'crunchyroll', 'tvmaze'),

   -- Fubo variations
   (13, 'fubo', 'tvmaze'),
   (13, 'fubotv', 'tvmaze'),
   (13, 'fubo tv', 'tvmaze'),

   -- Tubi variations
   (14, 'tubi', 'tvmaze'),
   (14, 'tubi tv', 'tvmaze'),

   -- Starz variations
   (15, 'starz', 'tvmaze')
;

