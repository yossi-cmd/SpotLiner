-- Track featured (secondary) artists
-- Run after schema: psql $DATABASE_URL -f db/migration-featured-artists.sql

CREATE TABLE IF NOT EXISTS track_featured_artists (
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (track_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_track_featured_artists_track ON track_featured_artists(track_id);
