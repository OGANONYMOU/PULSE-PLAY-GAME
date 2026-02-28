import { Router } from 'express';
import {
  getAllPosts,
  getPostById,
  getUserPosts,
  createPost,
  updatePost,
  deletePost,
  likePost,
  addComment,
  deleteComment
} from '../controllers/community.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { postValidation } from '../utils/validation.js';

const router = Router();

// Public
router.get('/posts',                  getAllPosts);
router.get('/posts/:postId',          getPostById);
router.get('/user/:userId/posts',     getUserPosts);
router.post('/posts/:postId/like',    likePost);

// Protected
router.post('/posts',                 authenticateToken, validateRequest(postValidation.create), createPost);
router.put('/posts/:postId',          authenticateToken, validateRequest(postValidation.update), updatePost);
router.delete('/posts/:postId',       authenticateToken, deletePost);
router.post('/posts/:postId/comments',authenticateToken, addComment);
router.delete('/comments/:commentId', authenticateToken, deleteComment);

export default router;
