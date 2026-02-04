import jwt from 'jsonwebtoken';
import { config } from './environment';

export interface JwtPayload {
  id: string;
  email: string;
  iat?: number;
  exp?: number;
}

export const generateToken = (userId: string, email: string): string => {
  return jwt.sign(
    { id: userId, email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
};

export const decodeToken = (token: string): JwtPayload | null => {
  return jwt.decode(token) as JwtPayload | null;
};
