/**
 * איפוס סיסמה למשתמש לפי אימייל.
 * הרצה: cd server && node scripts/reset-password.js "your@email.com" "הסיסמה-החדשה"
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../db/index.js';

const SALT_ROUNDS = 10;

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('שימוש: node scripts/reset-password.js "email@example.com" "סיסמה-חדשה"');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('הסיסמה חייבת להכיל לפחות 6 תווים.');
  process.exit(1);
}

async function reset() {
  const emailNorm = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const res = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2 RETURNING id, email',
    [passwordHash, emailNorm]
  );
  if (res.rows.length === 0) {
    console.error('לא נמצא משתמש עם האימייל:', email);
    process.exit(1);
  }
  console.log('הסיסמה עודכנה בהצלחה עבור:', res.rows[0].email);
  process.exit(0);
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});
