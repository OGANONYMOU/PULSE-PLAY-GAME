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
} from '../controllers/game.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { gameValidation } from '../utils/validation.js';

const router = Router();

// Public
router.get('/',                  getAllGames);
router.get('/search',            searchGames);
router.get('/category/:category',getGamesByCategory);
router.get('/:gameId',           getGameById);

// Protected
router.post('/',         authenticateToken, validateRequest(gameValidation.create), createGame);
router.put('/:gameId',   authenticateToken, validateRequest(gameValidation.update), updateGame);
router.delete('/:gameId',authenticateToken, deleteGame);
router.post('/:gameId/stats', authenticateToken, updateGameStats);

export default router;
