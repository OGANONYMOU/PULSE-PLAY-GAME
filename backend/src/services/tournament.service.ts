import prisma from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export class TournamentService {
  async getAllTournaments(skip: number = 0, take: number = 20, status?: string) {
    const where = status ? { status } : {};

    const [tournaments, total] = await Promise.all([
      prisma.tournament.findMany({
        where,
        skip,
        take,
        include: {
          game: true,
          participants: {
            select: {
              id: true,
              user: {
                select: { id: true, username: true, profilePicture: true }
              },
              rank: true,
              score: true
            }
          },
          _count: {
            select: { participants: true }
          }
        },
        orderBy: { startDate: 'desc' }
      }),
      prisma.tournament.count({ where })
    ]);

    return {
      tournaments,
      pagination: {
        skip,
        take,
        total,
        pages: Math.ceil(total / take)
      }
    };
  }

  async getTournamentById(tournamentId: string) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        game: true,
        participants: {
          include: {
            user: {
              select: { id: true, username: true, profilePicture: true, bio: true }
            }
          },
          orderBy: { rank: 'asc' }
        },
        _count: {
          select: { participants: true }
        }
      }
    });

    if (!tournament) {
      throw new NotFoundError('Tournament not found');
    }

    return tournament;
  }

  async getTournamentsByGame(gameId: string) {
    return prisma.tournament.findMany({
      where: { gameId },
      include: {
        game: true,
        _count: {
          select: { participants: true }
        }
      },
      orderBy: { startDate: 'desc' }
    });
  }

  async createTournament(data: any) {
    return prisma.tournament.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null
      },
      include: {
        game: true
      }
    });
  }

  async updateTournament(tournamentId: string, data: any) {
    return prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined
      },
      include: {
        game: true,
        participants: true
      }
    });
  }

  async joinTournament(tournamentId: string, userId: string) {
    return prisma.tournamentParticipant.create({
      data: {
        tournamentId,
        userId
      },
      include: {
        tournament: {
          include: { game: true }
        },
        user: true
      }
    });
  }

  async leaveTournament(tournamentId: string, userId: string) {
    return prisma.tournamentParticipant.delete({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId
        }
      }
    });
  }

  async updateParticipantRank(participantId: string, rank: number, score: number) {
    return prisma.tournamentParticipant.update({
      where: { id: participantId },
      data: { rank, score }
    });
  }

  async deleteTournament(tournamentId: string) {
    await prisma.tournament.delete({
      where: { id: tournamentId }
    });
  }
}

export const tournamentService = new TournamentService();
