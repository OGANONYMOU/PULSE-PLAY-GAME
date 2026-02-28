import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { communityService } from '../services/community.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/error.js';

// GET /api/community/posts
export const getAllPosts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const skip = parseInt(req.query.skip as string) || 0;
  const take = parseInt(req.query.take as string) || 20;
  const result = await communityService.getAllPosts(skip, take);
  res.json(successResponse(result, 'Posts retrieved'));
});

// GET /api/community/posts/:postId
export const getPostById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const post = await communityService.getPostById(req.params.postId);
  res.json(successResponse(post, 'Post retrieved'));
});

// GET /api/community/user/:userId/posts
export const getUserPosts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const posts = await communityService.getUserPosts(req.params.userId);
  res.json(successResponse(posts, 'User posts retrieved'));
});

// POST /api/community/posts
export const createPost = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { content, image } = req.body;
  const post = await communityService.createPost(userId, content, image);
  res.status(201).json(successResponse(post, 'Post created', 201));
});

// PUT /api/community/posts/:postId
export const updatePost = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { content, image } = req.body;
  const post = await communityService.updatePost(req.params.postId, userId, content, image);
  res.json(successResponse(post, 'Post updated'));
});

// DELETE /api/community/posts/:postId
export const deletePost = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await communityService.deletePost(req.params.postId, req.user!.id);
  res.json(successResponse(null, 'Post deleted'));
});

// POST /api/community/posts/:postId/like
export const likePost = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const post = await communityService.likePost(req.params.postId);
  res.json(successResponse(post, 'Post liked'));
});

// POST /api/community/posts/:postId/comments
export const addComment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { content } = req.body;
  const comment = await communityService.addComment(req.params.postId, userId, content);
  res.status(201).json(successResponse(comment, 'Comment added', 201));
});

// DELETE /api/community/comments/:commentId
export const deleteComment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await communityService.deleteComment(req.params.commentId, req.user!.id);
  res.json(successResponse(null, 'Comment deleted'));
});
