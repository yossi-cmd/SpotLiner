/**
 * PoC: Push notifications when a new track is uploaded for an artist the user has favorited.
 * Can be removed later.
 *
 * Required: In .env set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
 * Generate with: npx web-push generate-vapid-keys
 */
import pool from './db/index.js';

function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

export function getVapidPublicKey() {
  const keys = getVapidKeys();
  return keys ? keys.publicKey : null;
}

/** Send push notifications to users who have favorited any track by this artist (excluding uploader). */
export async function notifyNewTrackForArtist(artistId, artistName, trackTitle, trackId, excludeUserId = null) {
  const keys = getVapidKeys();
  if (!keys) return;

  let webpush;
  try {
    webpush = (await import('web-push')).default;
  } catch {
    return;
  }

  webpush.setVapidDetails(
    'mailto:yossi@yossibiton.com',
    keys.publicKey,
    keys.privateKey
  );

  const subs = await pool.query(
    `SELECT ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     INNER JOIN (
       SELECT DISTINCT f.user_id
       FROM favorites f
       INNER JOIN tracks t ON t.id = f.track_id
       WHERE t.artist_id = $1
       ${excludeUserId != null ? 'AND f.user_id != $2' : ''}
     ) u ON u.user_id = ps.user_id`,
    excludeUserId != null ? [artistId, excludeUserId] : [artistId]
  );

  const payload = JSON.stringify({
    title: 'שיר חדש',
    body: `${artistName}: ${trackTitle}`,
    url: `/artist/${artistId}`,
  });

  for (const row of subs.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        payload,
        { TTL: 60 }
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [row.endpoint]);
      }
    }
  }
}

/** Send a test push to one user (for debugging). Returns { sent, error? }. */
export async function sendTestPushToUser(userId) {
  const keys = getVapidKeys();
  if (!keys) return { sent: false, error: 'VAPID keys not set' };

  let webpush;
  try {
    webpush = (await import('web-push')).default;
  } catch (e) {
    return { sent: false, error: 'web-push not installed' };
  }

  const sub = await pool.query(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );
  if (!sub.rows.length) return { sent: false, error: 'No push subscription for this user' };

  webpush.setVapidDetails('mailto:support@spotliner.local', keys.publicKey, keys.privateKey);

  const payload = JSON.stringify({
    title: 'בדיקה',
    body: 'התראת טסט מספוטליינר',
    url: '/',
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.rows[0].endpoint,
        keys: { p256dh: sub.rows[0].p256dh, auth: sub.rows[0].auth },
      },
      payload,
      { TTL: 60 }
    );
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err.message || String(err) };
  }
}
