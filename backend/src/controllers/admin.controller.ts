import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import * as adminService from '../services/admin.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/error.js';

export const getStats        = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const stats = await adminService.getOverviewStats();
  res.json(successResponse(stats, 'Stats retrieved'));
});

// Users
export const listUsers       = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page   = parseInt(req.query.page   as string) || 1;
  const limit  = parseInt(req.query.limit  as string) || 20;
  const search = req.query.search as string | undefined;
  const role   = req.query.role   as string | undefined;
  res.json(successResponse(await adminService.getAllUsers(page, limit, search, role)));
});

export const getUser         = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await adminService.getUserById(req.params.userId);
  res.json(successResponse(user));
});

export const setUserRole     = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.body;
  const user = await adminService.updateUserRole(req.params.userId, role);
  res.json(successResponse(user, 'Role updated'));
});

export const banUserCtrl     = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  const user = await adminService.banUser(req.params.userId, reason || 'Violation of terms');
  res.json(successResponse(user, 'User banned'));
});

export const unbanUserCtrl   = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await adminService.unbanUser(req.params.userId);
  res.json(successResponse(user, 'User unbanned'));
});

export const deleteUserCtrl  = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await adminService.deleteUser(req.params.userId);
  res.json(successResponse(null, 'User deleted'));
});

// Tournaments
export const listTournaments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page   = parseInt(req.query.page   as string) || 1;
  const limit  = parseInt(req.query.limit  as string) || 20;
  const status = req.query.status as string | undefined;
  res.json(successResponse(await adminService.getAllTournamentsAdmin(page, limit, status)));
});

export const setTournamentStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  const t = await adminService.updateTournamentStatus(req.params.id, status);
  res.json(successResponse(t, 'Tournament status updated'));
});

export const deleteTournamentCtrl = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await adminService.deleteTournamentAdmin(req.params.id);
  res.json(successResponse(null, 'Tournament deleted'));
});

// Posts
export const listPosts       = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page   = parseInt(req.query.page   as string) || 1;
  const limit  = parseInt(req.query.limit  as string) || 20;
  const hidden = req.query.hidden !== undefined ? req.query.hidden === 'true' : undefined;
  res.json(successResponse(await adminService.getAllPostsAdmin(page, limit, hidden)));
});

export const hidePostCtrl    = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await adminService.hidePost(req.params.postId), 'Post hidden'));
});

export const unhidePostCtrl  = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await adminService.unhidePost(req.params.postId), 'Post restored'));
});

export const pinPostCtrl     = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await adminService.pinPost(req.params.postId), 'Post pinned'));
});

export const deletePostCtrl  = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await adminService.deletePostAdmin(req.params.postId);
  res.json(successResponse(null, 'Post deleted'));
});

// Games
export const listGames       = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await adminService.getAllGamesAdmin()));
});
