--
-- Add Plex as a platform option
--
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM platforms
        WHERE name = 'Plex'
    ) THEN
      INSERT INTO platforms (created_at, updated_at, name, icon) VALUES (now(), now(), 'Plex', 'plex');
    END IF;
END $$;

