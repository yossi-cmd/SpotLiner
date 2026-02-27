-- Add cover/image path for artists, albums, tracks
ALTER TABLE artists ADD COLUMN IF NOT EXISTS image_path VARCHAR(500);
ALTER TABLE albums ADD COLUMN IF NOT EXISTS image_path VARCHAR(500);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS image_path VARCHAR(500);
