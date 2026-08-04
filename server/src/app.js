import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';
import authRouter from './routes/auth.js';
import barbersRouter from './routes/barbers.js';
import bookingsRouter from './routes/bookings.js';
import servicesRouter from './routes/services.js';
import slotsRouter from './routes/slots.js';
import adminServicesRouter from './routes/adminServices.js';
import adminBarbersRouter from './routes/adminBarbers.js';
import settingsRouter from './routes/settings.js';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/barbers', barbersRouter);
app.use('/api/services', servicesRouter);
app.use('/api/slots', slotsRouter);

app.use('/api/bookings', bookingsRouter);

// Protected routes
app.use('/api/admin/services', requireAuth, adminServicesRouter);
app.use('/api/admin/barbers', requireAuth, adminBarbersRouter);
app.use('/api/admin/settings', requireAuth, settingsRouter);

app.use(errorHandler);

export default app;

