import { Router } from 'express';
import { register, signin, oauthRedirect, oauthCallback } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { authValidation } from '../utils/validation';

const router = Router();

// Public routes
router.post('/register', validateRequest(authValidation.register), register);
router.post('/signin', validateRequest(authValidation.signin), signin);

// OAuth start and callback handlers
router.get('/:provider', oauthRedirect);
router.get('/:provider/callback', oauthCallback);

// Profile endpoints (example placeholders)
router.get('/profile', authenticateToken, (req, res) => res.json({ ok: true }));

export default router;
