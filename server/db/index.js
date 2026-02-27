import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  return res;
}

/** Run migrations that must exist for the app to work (e.g. track_featured_artists). */
export async function runStartupMigrations() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS track_featured_artists (
        track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (track_id, artist_id)
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_track_featured_artists_track ON track_featured_artists(track_id)
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id)
      )
    `);
  } catch (err) {
    console.error('Startup migration (track_featured_artists) failed:', err.message);
  }
}

export default pool;
