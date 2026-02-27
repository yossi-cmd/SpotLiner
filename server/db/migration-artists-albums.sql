-- Run on existing DB: psql $DATABASE_URL -f server/db/migration-artists-albums.sql
-- Adds artists, albums and links from tracks.

CREATE TABLE IF NOT EXISTS artists (
  id SERIAL PRIMARY KEY,
  name VARCHAR(500) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS albums (
  id SERIAL PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(artist_id, name)
);

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL;

-- Backfill: create artists from distinct track.artist
INSERT INTO artists (name)
SELECT DISTINCT trim(artist) FROM tracks WHERE trim(artist) <> ''
ON CONFLICT (name) DO NOTHING;

-- Backfill: create albums and set track artist_id
UPDATE tracks t
SET artist_id = (SELECT id FROM artists a WHERE a.name = trim(t.artist) LIMIT 1)
WHERE t.artist_id IS NULL AND trim(t.artist) <> '';

INSERT INTO albums (name, artist_id)
SELECT DISTINCT trim(t.album), t.artist_id
FROM tracks t
WHERE t.artist_id IS NOT NULL AND trim(COALESCE(t.album, '')) <> ''
ON CONFLICT (artist_id, name) DO NOTHING;

UPDATE tracks t
SET album_id = (SELECT id FROM albums al WHERE al.artist_id = t.artist_id AND al.name = trim(COALESCE(t.album, '')) LIMIT 1)
WHERE t.album_id IS NULL AND t.artist_id IS NOT NULL AND trim(COALESCE(t.album, '')) <> '';

CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id);
