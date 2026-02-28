import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/environment.js';
import authRoutes       from './routes/auth.routes.js';
import gameRoutes       from './routes/game.routes.js';
import tournamentRoutes from './routes/tournament.routes.js';
import communityRoutes  from './routes/community.routes.js';
import adminRoutes      from './routes/admin.routes.js';
import { errorHandler } from './middleware/error.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// In dev: __dirname = backend/src → go up 2 dirs → project root → frontend
// In prod (dist/): __dirname = backend/dist → go up 2 dirs → project root → frontend
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

const app = express();

// ── Security ────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.node_env === 'production' ? 'combined' : 'dev'));
app.use(cors({ origin: config.cors.origin, credentials: config.cors.credentials }));

// ── Rate Limiting ───────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, slow down.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, try again later.' }
});

app.use('/api',      apiLimiter);
app.use('/api/auth', authLimiter);

// ── API Routes ──────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/games',       gameRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/community',   communityRoutes);
app.use('/api/admin',       adminRoutes);

// ── Health ──────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    env: config.node_env,
    ts: new Date().toISOString(),
  });
});

// ── Serve Frontend Static Files ──────────────────────────────────
app.use(express.static(frontendPath));

// SPA fallback — send index.html for any non-API route
// (handles /admin/, /oauth-callback.html, etc.)
app.use((_req, res, next) => {
  if (_req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
    if (err) next(err);
  });
});

// ── Error Handler ───────────────────────────────────────────────
app.use(errorHandler);

// ── Start ───────────────────────────────────────────────────────
const port = config.port;
app.listen(port, () => {
  console.log('');
  console.log('  🎮  PulsePay');
  console.log(`  🌐  http://localhost:${port}`);
  console.log(`  ⚙️   http://localhost:${port}/admin/`);
  console.log(`  💚  http://localhost:${port}/api/health`);
  console.log('');
});

export default app;
