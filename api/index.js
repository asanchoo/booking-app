import app from '../server/src/app.js';
import { validateEnvironment } from '../server/src/config/env.js';

validateEnvironment();

export default app;
