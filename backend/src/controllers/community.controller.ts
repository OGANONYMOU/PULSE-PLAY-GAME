import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { tournamentService } from '../services/tournament.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../middleware/error';

export const getAllTournaments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const skip = parseInt(req.query.skip as string) || 0;
  const take = parseInt(req.query.take as string) || 20;
  const status = req.query.status as string | undefined;

  const result = await tournamentService.getAllTournaments(skip, take, status);

  res.json(
    successResponse(result, 'Tournaments retrieved successfully')
  );
});

export const getTournamentById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tournamentId } = req.params;
  const tournament = await tournamentService.getTournamentById(tournamentId);

  res.json(
    successResponse(tournament, 'Tournament retrieved successfully')
  );
});

export const getTournamentsByGame = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { gameId } = req.params;
  const tournaments = await tournamentService.getTournamentsByGame(gameId);

  res.json(
    successResponse(tournaments, 'Tournaments by game retrieved successfully')
  );
});

export const createTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tournament = await tournamentService.createTournament(req.body);

  res.status(201).json(
    successResponse(tournament, 'Tournament created successfully', 201)
  );
});

export const updateTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tournamentId } = req.params;
  const tournament = await tournamentService.updateTournament(tournamentId, req.body);

  res.json(
    successResponse(tournament, 'Tournament updated successfully')
  );
});

export const joinTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { tournamentId } = req.params;

  if (!userId) {
    throw new Error('User ID not found');
  }

  const participant = await tournamentService.joinTournament(tournamentId, userId);

  res.status(201).json(
    successResponse(participant, 'Joined tournament successfully', 201)
  );
});

export const leaveTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { tournamentId } = req.params;

  if (!userId) {
    throw new Error('User ID not found');
  }

  await tournamentService.leaveTournament(tournamentId, userId);

  res.json(
    successResponse(null, 'Left tournament successfully')
  );
});

export const updateParticipantRank = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { participantId } = req.params;
  const { rank, score } = req.body;

  const participant = await tournamentService.updateParticipantRank(participantId, rank, score);

  res.json(
    successResponse(participant, 'Participant rank updated successfully')
  );
});

export const deleteTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tournamentId } = req.params;
  await tournamentService.deleteTournament(tournamentId);

  res.json(
    successResponse(null, 'Tournament deleted successfully')
  );
});
