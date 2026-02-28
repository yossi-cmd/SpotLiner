/**
 * שליחת הודעת push מהטרמינל – לכל המנויים או למשתמש מסוים.
 * שדות אופציונליים: --title, --url, --user, --icon, --image, --badge, --tag
 * הרצה: cd server && node scripts/send-push.js שלום לכולם
 *        cd server && node scripts/send-push.js הודעה --image https://example.com/cover.jpg
 */
import 'dotenv/config';
import pool from '../db/index.js';
import { sendCustomPush } from '../push.js';

const args = process.argv.slice(2);
let title = 'הודעה';
let url = '/';
let userArg = null;
let icon = null;
let image = null;
let badge = null;
let tag = null;
const bodyParts = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--title' && args[i + 1] != null) {
    title = args[++i];
  } else if (args[i] === '--url' && args[i + 1] != null) {
    url = args[++i];
  } else if (args[i] === '--user' && args[i + 1] != null) {
    userArg = args[++i];
  } else if (args[i] === '--icon' && args[i + 1] != null) {
    icon = args[++i];
  } else if (args[i] === '--image' && args[i + 1] != null) {
    image = args[++i];
  } else if (args[i] === '--badge' && args[i + 1] != null) {
    badge = args[++i];
  } else if (args[i] === '--tag' && args[i + 1] != null) {
    tag = args[++i];
  } else {
    bodyParts.push(args[i]);
  }
}

const body = bodyParts.join(' ').trim();
if (!body) {
  console.error('שימוש: node scripts/send-push.js <טקסט> [--title כותרת] [--url /path] [--user ID|email] [--icon URL] [--image URL] [--badge URL] [--tag מחרוזת]');
  process.exit(1);
}

async function main() {
  let userId = null;
  if (userArg != null) {
    const id = parseInt(userArg, 10);
    if (!Number.isNaN(id)) {
      userId = id;
    } else {
      const r = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [userArg.trim().toLowerCase()]);
      if (!r.rows.length) {
        console.error('לא נמצא משתמש עם אימייל או id:', userArg);
        process.exit(1);
      }
      userId = r.rows[0].id;
    }
  }
  const result = await sendCustomPush({ title, body, url, userId, icon, image, badge, tag });
  if (result.errors?.length) {
    console.error('שגיאות:', result.errors);
  }
  console.log(`נשלח: ${result.sent}, נכשל: ${result.failed}`);
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
