import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../config/jwt';
import { ConflictError, AuthenticationError, NotFoundError } from '../utils/errors';

class AuthService {
  async register({ email, username, password, firstName, lastName, phone }: any) {
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) {
      if (existing.email === email) throw new ConflictError('Email already registered');
      throw new ConflictError('Username already taken');
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, username, password: hashed, firstName, lastName, phone }
    });

    const token = generateToken(user.id, user.email);
    return { user, token };
  }

  async signin({ email, password }: any) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) throw new AuthenticationError('Invalid credentials');

    const ok = await comparePassword(password, user.password);
    if (!ok) throw new AuthenticationError('Invalid credentials');

    const token = generateToken(user.id, user.email);
    return { user, token };
  }

  async findOrCreateOAuthUser({ provider, providerId, email, username, firstName, lastName, avatar }: any) {
    const whereClause: any = {};
    if (provider === 'google') whereClause.googleId = providerId;
    if (provider === 'discord') whereClause.discordId = providerId;
    if (provider === 'facebook') whereClause.facebookId = providerId;
    if (provider === 'twitter') whereClause.twitterId = providerId;

    let user = await prisma.user.findFirst({ where: whereClause });
    if (!user) user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          username: username || `${provider}_${providerId}`,
          firstName,
          lastName,
          profilePicture: avatar,
          ...(provider === 'google' && { googleId: providerId }),
          ...(provider === 'discord' && { discordId: providerId }),
          ...(provider === 'facebook' && { facebookId: providerId }),
          ...(provider === 'twitter' && { twitterId: providerId })
        }
      });
    }

    const token = generateToken(user.id, user.email);
    return { user, token };
  }
}

export const authService = new AuthService();

