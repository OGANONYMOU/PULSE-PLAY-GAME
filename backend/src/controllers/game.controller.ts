import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { gameService } from '../services/game.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/error.js';

export const getAllGames = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const skip = parseInt(req.query.skip as string) || 0;
  const take = parseInt(req.query.take as string) || 20;

  const result = await gameService.getAllGames(skip, take);

  res.json(
    successResponse(result, 'Games retrieved successfully')
  );
});

export const getGameById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { gameId } = req.params;
  const game = await gameService.getGameById(gameId);

  res.json(
    successResponse(game, 'Game retrieved successfully')
  );
});

export const searchGames = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { query } = req.query;
  if (!query) {
    res.json(successResponse([], 'No search query provided'));
    return;
  }

  const games = await gameService.searchGames(query as string);

  res.json(
    successResponse(games, 'Games search results')
  );
});

export const getGamesByCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { category } = req.params;
  const games = await gameService.getGamesByCategory(category);

  res.json(
    successResponse(games, 'Games by category retrieved successfully')
  );
});

export const createGame = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const game = await gameService.createGame(req.body);

  res.status(201).json(
    successResponse(game, 'Game created successfully', 201)
  );
});

export const updateGame = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { gameId } = req.params;
  const game = await gameService.updateGame(gameId, req.body);

  res.json(
    successResponse(game, 'Game updated successfully')
  );
});

export const deleteGame = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { gameId } = req.params;
  await gameService.deleteGame(gameId);

  res.json(
    successResponse(null, 'Game deleted successfully')
  );
});

export const updateGameStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { gameId } = req.params;

  if (!userId) {
    throw new Error('User ID not found');
  }

  const stats = await gameService.updateGameStats(userId, gameId, req.body);

  res.json(
    successResponse(stats, 'Game stats updated successfully')
  );
});
