import cors from 'cors';
import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import bookingsRouter from './routes/bookings.js';
import servicesRouter from './routes/services.js';
import slotsRouter from './routes/slots.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/services', servicesRouter);
app.use('/api/slots', slotsRouter);
app.use('/api/bookings', bookingsRouter);

app.use(errorHandler);

export default app;
