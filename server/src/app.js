import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';
import authRouter from './routes/auth.js';
import clientAuthRouter from './routes/clientAuth.js';
import myBookingsRouter from './routes/myBookings.js';
import barbersRouter from './routes/barbers.js';
import bookingsRouter from './routes/bookings.js';
import servicesRouter from './routes/services.js';
import slotsRouter from './routes/slots.js';
import adminServicesRouter from './routes/adminServices.js';
import adminBarbersRouter from './routes/adminBarbers.js';
import settingsRouter from './routes/settings.js';
import barberPortalRouter from './routes/barberPortal.js';
import adminReviewsRouter from './routes/adminReviews.js';
import adminBookingsRouter from './routes/adminBookings.js';
import aiAssistantRouter from './routes/aiAssistant.js';
import integrationsRouter from './routes/integrations.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5176')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Admin Auth
app.use('/api/auth', authRouter);

// Client Auth (OTP) & Client Profile
app.use('/api/client-auth', clientAuthRouter);
app.use('/api/my-bookings', myBookingsRouter);
app.use('/api/barber', barberPortalRouter);

// Public Booking Routes
app.use('/api/barbers', barbersRouter);
app.use('/api/services', servicesRouter);
app.use('/api/slots', slotsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/ai', aiAssistantRouter);
app.use('/api/integrations', integrationsRouter);

// Protected Admin Routes
app.use('/api/admin/services', requireAuth, adminServicesRouter);
app.use('/api/admin/barbers', requireAuth, adminBarbersRouter);
app.use('/api/admin/settings', requireAuth, settingsRouter);
app.use('/api/admin/reviews', requireAuth, adminReviewsRouter);
app.use('/api/admin/bookings', requireAuth, adminBookingsRouter);

if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

export default app;
