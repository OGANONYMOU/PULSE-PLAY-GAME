import { Router } from 'express';
import {
  getAllGames,
  getGameById,
  searchGames,
  getGamesByCategory,
  createGame,
  updateGame,
  deleteGame,
  updateGameStats
} from '../controllers/game.controller';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { gameValidation } from '../utils/validation';

const router = Router();

// Public routes
router.get('/', getAllGames);
router.get('/search', searchGames);
router.get('/category/:category', getGamesByCategory);
router.get('/:gameId', getGameById);

// Protected routes
router.post('/', authenticateToken, validateRequest(gameValidation.create), createGame);
router.put('/:gameId', authenticateToken, validateRequest(gameValidation.update), updateGame);
router.delete('/:gameId', authenticateToken, deleteGame);
router.post('/:gameId/stats', authenticateToken, updateGameStats);

export default router;
