import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { tournamentService } from '../services/tournament.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/error.js';

// GET /api/tournaments
export const getAllTournaments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const skip   = parseInt(req.query.skip   as string) || 0;
  const take   = parseInt(req.query.take   as string) || 20;
  const status = req.query.status as string | undefined;

  const result = await tournamentService.getAllTournaments(skip, take, status);
  res.json(successResponse(result, 'Tournaments retrieved'));
});

// GET /api/tournaments/:tournamentId
export const getTournamentById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tournament = await tournamentService.getTournamentById(req.params.tournamentId);
  res.json(successResponse(tournament, 'Tournament retrieved'));
});

// GET /api/tournaments/game/:gameId
export const getTournamentsByGame = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tournaments = await tournamentService.getTournamentsByGame(req.params.gameId);
  res.json(successResponse(tournaments, 'Tournaments retrieved'));
});

// POST /api/tournaments
export const createTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, gameId, description, prizePool, maxParticipants, startDate, endDate } = req.body;
  const tournament = await tournamentService.createTournament({
    name, gameId, description, prizePool, maxParticipants, startDate, endDate
  });
  res.status(201).json(successResponse(tournament, 'Tournament created', 201));
});

// PUT /api/tournaments/:tournamentId
export const updateTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tournament = await tournamentService.updateTournament(req.params.tournamentId, req.body);
  res.json(successResponse(tournament, 'Tournament updated'));
});

// POST /api/tournaments/:tournamentId/join
export const joinTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const participant = await tournamentService.joinTournament(req.params.tournamentId, userId);
  res.status(201).json(successResponse(participant, 'Joined tournament', 201));
});

// POST /api/tournaments/:tournamentId/leave
export const leaveTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  await tournamentService.leaveTournament(req.params.tournamentId, userId);
  res.json(successResponse(null, 'Left tournament'));
});

// PUT /api/tournaments/participant/:participantId/rank
export const updateParticipantRank = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { rank, score } = req.body;
  const participant = await tournamentService.updateParticipantRank(req.params.participantId, rank, score);
  res.json(successResponse(participant, 'Rank updated'));
});

// DELETE /api/tournaments/:tournamentId
export const deleteTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await tournamentService.deleteTournament(req.params.tournamentId);
  res.json(successResponse(null, 'Tournament deleted'));
});
