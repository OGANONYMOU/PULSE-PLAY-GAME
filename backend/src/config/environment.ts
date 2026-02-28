import dotenv from 'dotenv';
dotenv.config();

export const config = {
  node_env:   process.env.NODE_ENV || 'development',
  port:       parseInt(process.env.PORT || '5000', 10),
  apiUrl:     process.env.API_URL || 'http://localhost:5000',
  frontendUrl:process.env.FRONTEND_URL || 'http://localhost:5000',

  database: { url: process.env.DATABASE_URL! },

  jwt: {
    secret:    process.env.JWT_SECRET || 'CHANGE_ME_32CHARS_MINIMUM_ENTROPY',
    expiresIn: process.env.JWT_EXPIRE || '7d',
  },

  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5000,http://localhost:3000').split(','),
    credentials: true,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};
