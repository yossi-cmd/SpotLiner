import app from '../server/app.js';
import serverless from 'serverless-http';

export default serverless(app);
