--
-- Add poster_image column to shows table
--
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'shows'
          AND column_name = 'poster_image'
    ) THEN
      ALTER TABLE shows ADD COLUMN poster_image text;
    END IF;
END $$;
