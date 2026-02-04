import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { communityService } from '../services/community.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../middleware/error';
import { validateRequest } from '../middleware/validation';
import { postValidation } from '../utils/validation';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all posts
router.get('/posts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const skip = parseInt(req.query.skip as string) || 0;
  const take = parseInt(req.query.take as string) || 20;

  const result = await communityService.getAllPosts(skip, take);
  res.json(successResponse(result, 'Posts retrieved successfully'));
}));

// Get single post
router.get('/posts/:postId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { postId } = req.params;
  const post = await communityService.getPostById(postId);

  res.json(successResponse(post, 'Post retrieved successfully'));
}));

// Get user posts
router.get('/user/:userId/posts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const posts = await communityService.getUserPosts(userId);

  res.json(successResponse(posts, 'User posts retrieved successfully'));
}));

// Create post
router.post('/posts', authenticateToken, validateRequest(postValidation.create), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { content, image } = req.body;

  if (!userId) {
    throw new Error('User ID not found');
  }

  const post = await communityService.createPost(userId, content, image);

  res.status(201).json(
    successResponse(post, 'Post created successfully', 201)
  );
}));

// Update post
router.put('/posts/:postId', authenticateToken, validateRequest(postValidation.update), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { postId } = req.params;
  const { content, image } = req.body;

  if (!userId) {
    throw new Error('User ID not found');
  }

  const post = await communityService.updatePost(postId, userId, content, image);

  res.json(successResponse(post, 'Post updated successfully'));
}));

// Delete post
router.delete('/posts/:postId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { postId } = req.params;

  if (!userId) {
    throw new Error('User ID not found');
  }

  await communityService.deletePost(postId, userId);

  res.json(successResponse(null, 'Post deleted successfully'));
}));

// Like post
router.post('/posts/:postId/like', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { postId } = req.params;
  const post = await communityService.likePost(postId);

  res.json(successResponse(post, 'Post liked successfully'));
}));

// Add comment
router.post('/posts/:postId/comments', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { postId } = req.params;
  const { content } = req.body;

  if (!userId) {
    throw new Error('User ID not found');
  }

  const comment = await communityService.addComment(postId, userId, content);

  res.status(201).json(
    successResponse(comment, 'Comment added successfully', 201)
  );
}));

// Delete comment
router.delete('/comments/:commentId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { commentId } = req.params;

  if (!userId) {
    throw new Error('User ID not found');
  }

  await communityService.deleteComment(commentId, userId);

  res.json(successResponse(null, 'Comment deleted successfully'));
}));

export default router;
