import { Router, Request, Response } from 'express';
import { register, signin, getMe, oauthRedirect, oauthCallback } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { authValidation } from '../utils/validation.js';

const router = Router();

// Returns which OAuth providers are actually configured (env vars set)
// Frontend uses this to enable/disable social buttons
router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      google:   !!(process.env.GOOGLE_CLIENT_ID   && process.env.GOOGLE_CLIENT_SECRET),
      discord:  !!(process.env.DISCORD_CLIENT_ID  && process.env.DISCORD_CLIENT_SECRET),
      facebook: !!(process.env.FACEBOOK_APP_ID    && process.env.FACEBOOK_APP_SECRET),
      twitter:  !!(process.env.TWITTER_CLIENT_ID  && process.env.TWITTER_CLIENT_SECRET),
    }
  });
});

router.post('/register', validateRequest(authValidation.register), register);
router.post('/signin',   validateRequest(authValidation.signin),   signin);
router.get('/me',        authenticateToken, getMe);

// OAuth — callback MUST be before /:provider to avoid route collision
router.get('/:provider/callback', oauthCallback);
router.get('/:provider',          oauthRedirect);

export default router;
