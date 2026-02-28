import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/error.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { config } from '../config/environment.js';

// ── Email / Password ──────────────────────────────────────────

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, firstName, lastName, phone } = req.body;
  const { user, token } = await authService.register({ username, email, password, firstName, lastName, phone });
  const { password: _pw, ...safeUser } = user as any;
  res.status(201).json(successResponse({ user: safeUser, token }, 'Account created', 201));
});

export const signin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { user, token } = await authService.signin({ email, password });
  const { password: _pw, ...safeUser } = user as any;
  res.json(successResponse({ user: safeUser, token }, 'Signed in'));
});

export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await authService.findById((req as any).user.id);
  if (!user) return res.status(401).json(errorResponse('User not found', 401));
  const { password: _pw, ...safe } = user as any;
  res.json(successResponse(safe));
});

// ── OAuth — redirect to provider ─────────────────────────────
export const oauthRedirect = asyncHandler(async (req: Request, res: Response) => {
  const { provider } = req.params;
  const base = config.apiUrl;

  const redirects: Record<string, string | null> = {
    google: buildGoogleUrl(base),
    discord: buildDiscordUrl(base),
    facebook: buildFacebookUrl(base),
    twitter: buildTwitterUrl(base),
  };

  const url = redirects[provider];
  if (!url) {
    // Redirect back to signin page with error — never show raw JSON in browser
    return res.redirect(`${config.frontendUrl}/signin.html?error=not_configured&provider=${provider}`);
  }

  res.redirect(url);
});

// ── OAuth — exchange code for user ───────────────────────────
export const oauthCallback = asyncHandler(async (req: Request, res: Response) => {
  const { provider } = req.params;
  const code = req.query.code as string;

  if (!code) {
    return res.redirect(`${config.frontendUrl}/signin.html?error=oauth_cancelled`);
  }

  try {
    let profile: OAuthProfile;

    switch (provider) {
      case 'google':   profile = await exchangeGoogleCode(code); break;
      case 'discord':  profile = await exchangeDiscordCode(code); break;
      case 'facebook': profile = await exchangeFacebookCode(code); break;
      case 'twitter':  profile = await exchangeTwitterCode(code); break;
      default:
        return res.redirect(`${config.frontendUrl}/signin.html?error=unknown_provider`);
    }

    const { user, token } = await authService.findOrCreateOAuthUser({
      provider,
      providerId: profile.id,
      email: profile.email,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatar: profile.avatar,
    });

    // Redirect to frontend with token in fragment (never in query string)
    res.redirect(`${config.frontendUrl}/oauth-callback.html#token=${token}&user=${encodeURIComponent(JSON.stringify({ id: user.id, username: user.username, role: user.role, profilePicture: user.profilePicture }))}`);

  } catch (err: any) {
    console.error(`[OAuth ${provider}]`, err.message);
    res.redirect(`${config.frontendUrl}/signin.html?error=oauth_failed&msg=${encodeURIComponent(err.message)}`);
  }
});

// ── OAuth Exchange Helpers ────────────────────────────────────

interface OAuthProfile {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

function buildGoogleUrl(base: string): string | null {
  const { GOOGLE_CLIENT_ID } = process.env;
  if (!GOOGLE_CLIENT_ID) return null;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${base}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid profile email',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeGoogleCode(code: string): Promise<OAuthProfile> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  const base = config.apiUrl;

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${base}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json() as any;
  if (!tokenRes.ok) throw new Error(tokens.error_description || 'Google token exchange failed');

  // Get user profile
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const googleUser = await userRes.json() as any;

  return {
    id: googleUser.sub,
    email: googleUser.email,
    firstName: googleUser.given_name,
    lastName: googleUser.family_name,
    username: googleUser.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ''),
    avatar: googleUser.picture,
  };
}

function buildDiscordUrl(base: string): string | null {
  const { DISCORD_CLIENT_ID } = process.env;
  if (!DISCORD_CLIENT_ID) return null;
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: `${base}/api/auth/discord/callback`,
    response_type: 'code',
    scope: 'identify email',
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

async function exchangeDiscordCode(code: string): Promise<OAuthProfile> {
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = process.env;
  const base = config.apiUrl;

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: DISCORD_CLIENT_ID!,
      client_secret: DISCORD_CLIENT_SECRET!,
      redirect_uri: `${base}/api/auth/discord/callback`,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json() as any;
  if (!tokenRes.ok) throw new Error('Discord token exchange failed');

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const dUser = await userRes.json() as any;

  return {
    id: dUser.id,
    email: dUser.email,
    username: dUser.username,
    avatar: dUser.avatar ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png` : undefined,
  };
}

function buildFacebookUrl(base: string): string | null {
  const { FACEBOOK_APP_ID } = process.env;
  if (!FACEBOOK_APP_ID) return null;
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: `${base}/api/auth/facebook/callback`,
    response_type: 'code',
    scope: 'email,public_profile',
  });
  return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
}

async function exchangeFacebookCode(code: string): Promise<OAuthProfile> {
  const { FACEBOOK_APP_ID, FACEBOOK_APP_SECRET } = process.env;
  const base = config.apiUrl;

  const tokenRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&redirect_uri=${base}/api/auth/facebook/callback&code=${code}`
  );
  const tokens = await tokenRes.json() as any;
  if (!tokenRes.ok) throw new Error('Facebook token exchange failed');

  const userRes = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email,first_name,last_name,picture&access_token=${tokens.access_token}`
  );
  const fbUser = await userRes.json() as any;

  return {
    id: fbUser.id,
    email: fbUser.email || `fb_${fbUser.id}@noemail.pulsepay`,
    firstName: fbUser.first_name,
    lastName: fbUser.last_name,
    username: fbUser.name?.replace(/\s+/g, '').toLowerCase().slice(0, 20) || `fb${fbUser.id.slice(0, 8)}`,
    avatar: fbUser.picture?.data?.url,
  };
}

function buildTwitterUrl(base: string): string | null {
  const { TWITTER_CLIENT_ID } = process.env;
  if (!TWITTER_CLIENT_ID) return null;
  // Twitter OAuth 2.0 PKCE — client generates verifier, we use a simplified flow here
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: `${base}/api/auth/twitter/callback`,
    scope: 'tweet.read users.read offline.access',
    state: 'pulsepay',
    code_challenge: 'challenge',
    code_challenge_method: 'plain',
  });
  return `https://twitter.com/i/oauth2/authorize?${params}`;
}

async function exchangeTwitterCode(code: string): Promise<OAuthProfile> {
  const { TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET } = process.env;
  const base = config.apiUrl;

  const credentials = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64');
  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${base}/api/auth/twitter/callback`,
      code_verifier: 'challenge',
    }),
  });
  const tokens = await tokenRes.json() as any;
  if (!tokenRes.ok) throw new Error('Twitter token exchange failed');

  const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,name', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const { data: tUser } = await userRes.json() as any;

  return {
    id: tUser.id,
    email: `twitter_${tUser.id}@noemail.pulsepay`,
    username: tUser.username || `x${tUser.id.slice(0, 10)}`,
    firstName: tUser.name?.split(' ')[0],
    lastName: tUser.name?.split(' ').slice(1).join(' '),
    avatar: tUser.profile_image_url,
  };
}
