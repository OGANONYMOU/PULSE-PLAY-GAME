import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';

export class GameService {
  async getAllGames(skip: number = 0, take: number = 20) {
    const [games, total] = await Promise.all([
      prisma.game.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { tournaments: true, gameStats: true }
          }
        }
      }),
      prisma.game.count()
    ]);

    return {
      games,
      pagination: {
        skip,
        take,
        total,
        pages: Math.ceil(total / take)
      }
    };
  }

  async getGameById(gameId: string) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        tournaments: true,
        gameStats: true
      }
    });

    if (!game) {
      throw new NotFoundError('Game not found');
    }

    return game;
  }

  async searchGames(query: string) {
    return prisma.game.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 20
    });
  }

  async getGamesByCategory(category: string) {
    return prisma.game.findMany({
      where: {
        category: {
          contains: category,
          mode: 'insensitive'
        }
      }
    });
  }

  async createGame(data: any) {
    return prisma.game.create({
      data
    });
  }

  async updateGame(gameId: string, data: any) {
    const game = await prisma.game.update({
      where: { id: gameId },
      data
    });

    return game;
  }

  async deleteGame(gameId: string) {
    await prisma.game.delete({
      where: { id: gameId }
    });
  }

  async updateGameStats(userId: string, gameId: string, stats: any) {
    return prisma.gameStat.upsert({
      where: {
        userId_gameId: {
          userId,
          gameId
        }
      },
      update: {
        gamesPlayed: { increment: stats.gamesPlayed || 0 },
        wins: { increment: stats.wins || 0 },
        losses: { increment: stats.losses || 0 },
        highScore: stats.highScore ? Math.max(stats.highScore) : undefined,
        totalPoints: { increment: stats.totalPoints || 0 }
      },
      create: {
        userId,
        gameId,
        gamesPlayed: stats.gamesPlayed || 0,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        highScore: stats.highScore || 0,
        totalPoints: stats.totalPoints || 0
      }
    });
  }
}

export const gameService = new GameService();
