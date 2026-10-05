import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes.js';
import customerRoutes from './routes/customer.routes.js';
import enquiryRoutes from './routes/enquiry.routes.js';
import quotationRoutes from './routes/quotation.routes.js';
import productRoutes from './routes/product.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import salesOrderRoutes from './routes/sales-order.routes.js';
import auditRoutes from './routes/audit.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { env } from './config/env.js';

const configuredOrigins = (env.frontendOrigin || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;
  return /^http:\/\/localhost:(517[0-9]|517[0-9][0-9])$/.test(origin)
    || /^http:\/\/127\.0\.0\.1:(517[0-9]|517[0-9][0-9])$/.test(origin);
};

const app = express();
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: false,
}));
app.use(express.json({ limit: '200kb' }));
app.use(morgan(process.env.NODE_ENV === 'test' ? 'tiny' : 'dev'));
app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

