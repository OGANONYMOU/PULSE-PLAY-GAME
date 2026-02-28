import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { AuthorizationError } from '../utils/errors.js';
import { verifyToken } from '../config/jwt.js';
import prisma from '../config/database.js';

// Requires valid JWT + role ADMIN or MODERATOR
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (!token) throw new AuthorizationError('Admin access required');

    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true, isBanned: true }
    });

    if (!user || user.isBanned || !user.isActive) {
      throw new AuthorizationError('Account not authorized');
    }
    if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
      throw new AuthorizationError('Admin access required');
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
};

// Requires role ADMIN only (not MODERATOR)
export const requireSuperAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (!token) throw new AuthorizationError('Admin access required');

    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      throw new AuthorizationError('Super-admin access required');
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
};
