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
} from '../controllers/community.controller';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { tournamentValidation } from '../utils/validation';

const router = Router();

// Public routes
router.get('/', getAllTournaments);
router.get('/:tournamentId', getTournamentById);
router.get('/game/:gameId', getTournamentsByGame);

// Protected routes
router.post('/', authenticateToken, validateRequest(tournamentValidation.create), createTournament);
router.put('/:tournamentId', authenticateToken, validateRequest(tournamentValidation.update), updateTournament);
router.post('/:tournamentId/join', authenticateToken, joinTournament);
router.post('/:tournamentId/leave', authenticateToken, leaveTournament);
router.put('/participant/:participantId/rank', authenticateToken, updateParticipantRank);
router.delete('/:tournamentId', authenticateToken, deleteTournament);

export default router;
