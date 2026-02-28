/**
 * Netlify Function: מעטפת ל-Express של Spotliner.
 * כל בקשה ל-/api/* או /uploads/* מנותבת לכאן.
 */
import serverless from 'serverless-http';
import app from 'server/app.js';
import { runStartupMigrations } from 'server/db/index.js';

let migrated = false;

export const handler = async (event, context) => {
  if (!migrated) {
    try {
      await runStartupMigrations();
      migrated = true;
    } catch (err) {
      console.error('Startup migrations failed:', err);
    }
  }
  return serverless(app)(event, context);
};
