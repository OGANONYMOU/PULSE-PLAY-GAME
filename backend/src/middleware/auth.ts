import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt.js';
import { AuthenticationError } from '../utils/errors.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return next(new AuthenticationError('No token provided'));
  }

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch {
    next(new AuthenticationError('Invalid or expired token'));
  }
};
