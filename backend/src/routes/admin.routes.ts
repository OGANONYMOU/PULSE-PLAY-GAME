import { Router } from 'express';
import { requireAdmin, requireSuperAdmin } from '../middleware/admin.js';
import * as admin from '../controllers/admin.controller.js';

const router = Router();

// All admin routes require at minimum MODERATOR role
router.use(requireAdmin);

// Dashboard stats
router.get('/stats', admin.getStats);

// User management
router.get('/users',                     admin.listUsers);
router.get('/users/:userId',             admin.getUser);
router.patch('/users/:userId/role',      requireSuperAdmin, admin.setUserRole);
router.post('/users/:userId/ban',        admin.banUserCtrl);
router.post('/users/:userId/unban',      admin.unbanUserCtrl);
router.delete('/users/:userId',          requireSuperAdmin, admin.deleteUserCtrl);

// Tournament management
router.get('/tournaments',                      admin.listTournaments);
router.patch('/tournaments/:id/status',         admin.setTournamentStatus);
router.delete('/tournaments/:id',               requireSuperAdmin, admin.deleteTournamentCtrl);

// Post moderation
router.get('/posts',                     admin.listPosts);
router.patch('/posts/:postId/hide',      admin.hidePostCtrl);
router.patch('/posts/:postId/unhide',    admin.unhidePostCtrl);
router.patch('/posts/:postId/pin',       admin.pinPostCtrl);
router.delete('/posts/:postId',          admin.deletePostCtrl);

// Games
router.get('/games',                     admin.listGames);

export default router;
