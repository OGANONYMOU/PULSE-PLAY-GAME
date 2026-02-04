import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { successResponse, errorResponse } from '../utils/response';
import { asyncHandler } from '../middleware/error';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, firstName, lastName, phone } = req.body;
  const { user, token } = await authService.registerUser({ username, email, password, firstName, lastName, phone });
  res.status(201).json(successResponse({ user, token }, 'User registered', 201));
});

export const signin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { user, token } = await authService.signInUser({ email, password });
  res.status(200).json(successResponse({ user, token }, 'Signed in', 200));
});

export const oauthRedirect = asyncHandler(async (req: Request, res: Response) => {
  const provider = req.params.provider;
  // Build redirect URL based on provider config (use env)
  const { GOOGLE_CLIENT_ID, GOOGLE_CALLBACK_URL, DISCORD_CLIENT_ID, DISCORD_CALLBACK_URL, FACEBOOK_APP_ID, FACEBOOK_CALLBACK_URL, TWITTER_API_KEY, TWITTER_CALLBACK_URL } = process.env;

  if (provider === 'google' && GOOGLE_CLIENT_ID) {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid profile email',
      prompt: 'consent'
    });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }

  if (provider === 'discord' && DISCORD_CLIENT_ID) {
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: DISCORD_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/auth/discord/callback`,
      response_type: 'code',
      scope: 'identify email'
    });
    return res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
  }

  if (provider === 'facebook' && FACEBOOK_APP_ID) {
    const params = new URLSearchParams({
      client_id: FACEBOOK_APP_ID,
      redirect_uri: FACEBOOK_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/auth/facebook/callback`,
      response_type: 'code',
      scope: 'email,public_profile'
    });
    return res.redirect(`https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`);
  }

  if (provider === 'twitter' && TWITTER_API_KEY) {
    const params = new URLSearchParams({
      client_id: TWITTER_API_KEY,
      redirect_uri: TWITTER_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/auth/twitter/callback`,
      response_type: 'code',
      scope: 'tweet.read users.read'
    });
    return res.redirect(`https://twitter.com/i/oauth2/authorize?${params.toString()}`);
  }

  res.status(501).json(errorResponse('OAuth not configured for provider', 501));
});

export const oauthCallback = asyncHandler(async (req: Request, res: Response) => {
  const provider = req.params.provider;
  const code = req.query.code as string;
  // In a real app we'd exchange `code` for tokens server-side and fetch profile
  res.json({ message: `Received ${provider} callback`, provider, code: code || null });
});

