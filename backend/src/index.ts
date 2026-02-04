import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { config } from './config/environment';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './middleware/error';

dotenv.config();

const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cors({ origin: config.cors.origin, credentials: config.cors.credentials }));

app.use(rateLimit({ windowMs: config.rateLimit.windowMs, max: config.rateLimit.max }));

app.use('/api/auth', authRoutes);

// health
app.get('/api/health', (req, res) => res.json({ ok: true, env: config.node_env }));

// error handler (should be last)
app.use(errorHandler);

const port = config.port || 5000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
});

export default app;
 
