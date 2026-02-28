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

/** Log to console the full payload and meta sent to the browser (no keys/endpoints). */
function logPushToConsole(source, payload, meta = {}) {
  const out = { source, payload, ...meta };
  console.log('[Push]', JSON.stringify(out, null, 2));
}

/** Send push notification for a new track to all subscribers (excluding uploader). Includes uploader name. */
export async function notifyNewTrackToAll(uploaderName, artistId, artistName, trackTitle, trackId, excludeUserId = null) {
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
    `SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions
     WHERE ${excludeUserId != null ? 'user_id != $1' : '1=1'}`,
    excludeUserId != null ? [excludeUserId] : []
  );

  const userIds = [...new Set(subs.rows.map((r) => r.user_id))];
  const userNames = new Map();
  if (userIds.length) {
    const names = await pool.query(
      'SELECT id, COALESCE(display_name, email) AS name FROM users WHERE id = ANY($1)',
      [userIds]
    );
    names.rows.forEach((r) => userNames.set(r.id, r.name || null));
  }

  const baseByLine = uploaderName && uploaderName.trim()
    ? `הועלה על ידי ${uploaderName.trim()}: ${artistName} – ${trackTitle}`
    : `${artistName} – ${trackTitle}`;

  for (const row of subs.rows) {
    const recipientName = userNames.get(row.user_id) || null;
    const body = recipientName && recipientName.trim()
      ? `הי ${recipientName.trim()}, ${baseByLine}`
      : baseByLine;
    const payloadObj = {
      title: 'שיר חדש',
      body,
      url: artistId ? `/artist/${artistId}` : '/',
    };
    logPushToConsole('notifyNewTrackToAll', payloadObj, { recipient_user_id: row.user_id, track_id: trackId });
    const payload = JSON.stringify(payloadObj);
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        payload,
        { TTL: 60 }
      );
      await pool.query(
        `INSERT INTO push_notification_log (user_id, track_id, artist_id, artist_name, track_title, uploader_name, recipient_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.user_id, trackId, artistId, artistName, trackTitle, uploaderName || null, recipientName || null]
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

  const payloadObj = { title: 'בדיקה', body: 'התראת טסט מספוטליינר', url: '/' };
  logPushToConsole('sendTestPushToUser', payloadObj, { user_id: userId });
  const payload = JSON.stringify(payloadObj);
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

/**
 * Send a custom push message to all subscribers or to a specific user.
 * Optional: icon (URL), image (URL, large image – limited support), badge (URL), tag (replace/group).
 * @param {{ title: string, body: string, url?: string, userId?: number, icon?: string, image?: string, badge?: string, tag?: string }} options
 * @returns {{ sent: number, failed: number, errors?: string[] }}
 */
export async function sendCustomPush({ title, body, url = '/', userId = null, icon = null, image = null, badge = null, tag = null }) {
  const keys = getVapidKeys();
  if (!keys) return { sent: 0, failed: 0, errors: ['VAPID keys not set'] };

  let webpush;
  try {
    webpush = (await import('web-push')).default;
  } catch {
    return { sent: 0, failed: 0, errors: ['web-push not installed'] };
  }

  webpush.setVapidDetails(
    'mailto:yossi@yossibiton.com',
    keys.publicKey,
    keys.privateKey
  );

  const subs = await pool.query(
    `SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions
     WHERE ${userId != null ? 'user_id = $1' : '1=1'}`,
    userId != null ? [userId] : []
  );

  const payloadObj = { title: title || 'הודעה', body: body || '', url };
  if (icon) payloadObj.icon = icon;
  if (image) payloadObj.image = image;
  if (badge) payloadObj.badge = badge;
  if (tag) payloadObj.tag = tag;
  logPushToConsole('sendCustomPush', payloadObj, {
    target_user_id: userId ?? undefined,
    recipient_count: subs.rows.length,
    recipient_user_ids: subs.rows.map((r) => r.user_id),
  });
  const payload = JSON.stringify(payloadObj);
  let sent = 0;
  const errors = [];

  for (const row of subs.rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
        { TTL: 60 }
      );
      sent++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [row.endpoint]);
      }
      errors.push(`user ${row.user_id}: ${err.message || String(err)}`);
    }
  }

  return { sent, failed: subs.rows.length - sent, errors: errors.length ? errors : undefined };
}

/** Resend a previously sent notification (by log id) to the same user. */
export async function resendPushNotification(logId, userId) {
  const keys = getVapidKeys();
  if (!keys) return { sent: false, error: 'VAPID keys not set' };

  const log = await pool.query(
    'SELECT id, track_id, artist_id, artist_name, track_title, uploader_name, recipient_name FROM push_notification_log WHERE id = $1 AND user_id = $2',
    [logId, userId]
  );
  if (!log.rows.length) return { sent: false, error: 'Notification not found' };

  const row = log.rows[0];
  const sub = await pool.query(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );
  if (!sub.rows.length) return { sent: false, error: 'No push subscription' };

  let webpush;
  try {
    webpush = (await import('web-push')).default;
  } catch {
    return { sent: false, error: 'web-push not installed' };
  }

  webpush.setVapidDetails('mailto:yossi@yossibiton.com', keys.publicKey, keys.privateKey);

  const baseLine = row.uploader_name && row.uploader_name.trim()
    ? `הועלה על ידי ${row.uploader_name.trim()}: ${row.artist_name || 'אומן'} – ${row.track_title || 'שיר'}`
    : `${row.artist_name || 'אומן'}: ${row.track_title || 'שיר'}`;
  const bodyText = row.recipient_name && row.recipient_name.trim()
    ? `הי ${row.recipient_name.trim()}, ${baseLine}`
    : baseLine;
  const payloadObj = {
    title: 'שיר חדש',
    body: bodyText,
    url: row.artist_id ? `/artist/${row.artist_id}` : '/',
  };
  logPushToConsole('resendPushNotification', payloadObj, { log_id: logId, user_id: userId });
  const payload = JSON.stringify(payloadObj);
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
