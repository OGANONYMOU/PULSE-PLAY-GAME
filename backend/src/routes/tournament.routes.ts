import { Router } from 'express';
import {
  getAllTournaments,
  getTournamentById,
  getTournamentsByGame,
  createTournament,
  updateTournament,
  joinTournament,
  leaveTournament,
  updateParticipantRank,
  deleteTournament
} from '../controllers/tournament.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { tournamentValidation } from '../utils/validation.js';

const router = Router();

// Public
router.get('/',                           getAllTournaments);
router.get('/game/:gameId',               getTournamentsByGame);
router.get('/:tournamentId',              getTournamentById);

// Protected
router.post('/',                          authenticateToken, validateRequest(tournamentValidation.create), createTournament);
router.put('/:tournamentId',              authenticateToken, validateRequest(tournamentValidation.update), updateTournament);
router.post('/:tournamentId/join',        authenticateToken, joinTournament);
router.post('/:tournamentId/leave',       authenticateToken, leaveTournament);
router.put('/participant/:participantId/rank', authenticateToken, updateParticipantRank);
router.delete('/:tournamentId',           authenticateToken, deleteTournament);

export default router;
