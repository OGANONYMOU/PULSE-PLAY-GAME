import prisma from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../config/jwt.js';
import { ConflictError, AuthenticationError } from '../utils/errors.js';

class AuthService {
  async register({ email, username, password, firstName, lastName, phone }: {
    email: string; username: string; password: string;
    firstName?: string; lastName?: string; phone?: string;
  }) {
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) {
      throw new ConflictError(existing.email === email ? 'Email already registered' : 'Username already taken');
    }
    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, username, password: hashed, firstName, lastName, phone }
    });
    const token = generateToken(user.id, user.email);
    return { user, token };
  }

  async signin({ email, password }: { email: string; password: string }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) throw new AuthenticationError('Invalid email or password');
    if (user.isBanned) throw new AuthenticationError('Account suspended. Contact support.');
    const valid = await comparePassword(password, user.password);
    if (!valid) throw new AuthenticationError('Invalid email or password');

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } }
    });

    const token = generateToken(user.id, user.email);
    return { user, token };
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findOrCreateOAuthUser({ provider, providerId, email, username, firstName, lastName, avatar }: {
    provider: string; providerId: string; email: string;
    username?: string; firstName?: string; lastName?: string; avatar?: string;
  }) {
    const whereClause: Record<string, string> = {};
    if (provider === 'google')   whereClause.googleId   = providerId;
    if (provider === 'discord')  whereClause.discordId  = providerId;
    if (provider === 'facebook') whereClause.facebookId = providerId;
    if (provider === 'twitter')  whereClause.twitterId  = providerId;

    let user = await prisma.user.findFirst({ where: whereClause });
    if (!user && email && !email.includes('@noemail')) {
      user = await prisma.user.findUnique({ where: { email } });
    }

    if (!user) {
      // Ensure username is unique
      let finalUsername = username || `${provider}_${providerId.slice(0, 8)}`;
      const existing = await prisma.user.findUnique({ where: { username: finalUsername } });
      if (existing) finalUsername = `${finalUsername}_${Date.now().toString(36)}`;

      user = await prisma.user.create({
        data: {
          email: email || `oauth_${provider}_${providerId}@pulsepay.internal`,
          username: finalUsername,
          firstName, lastName,
          profilePicture: avatar,
          ...(provider === 'google'   && { googleId:   providerId }),
          ...(provider === 'discord'  && { discordId:  providerId }),
          ...(provider === 'facebook' && { facebookId: providerId }),
          ...(provider === 'twitter'  && { twitterId:  providerId }),
        }
      });
    } else {
      // Update existing user's OAuth link + avatar if missing
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          loginCount: { increment: 1 },
          profilePicture: user.profilePicture || avatar,
          ...(provider === 'google'   && !user.googleId   && { googleId:   providerId }),
          ...(provider === 'discord'  && !user.discordId  && { discordId:  providerId }),
          ...(provider === 'facebook' && !user.facebookId && { facebookId: providerId }),
          ...(provider === 'twitter'  && !user.twitterId  && { twitterId:  providerId }),
        }
      });
    }

    const token = generateToken(user.id, user.email);
    return { user, token };
  }
}

export const authService = new AuthService();
