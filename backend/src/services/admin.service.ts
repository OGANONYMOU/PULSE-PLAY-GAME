import prisma from '../config/database.js';

// ── Overview Stats ────────────────────────────────────────────
export async function getOverviewStats() {
  const [
    totalUsers,
    activeUsers,
    bannedUsers,
    newUsersToday,
    totalTournaments,
    activeTournaments,
    totalPosts,
    totalGames,
    recentSignups
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true, isBanned: false } }),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.user.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
    }),
    prisma.tournament.count(),
    prisma.tournament.count({ where: { status: 'ONGOING' } }),
    prisma.post.count({ where: { isHidden: false } }),
    prisma.game.count({ where: { isActive: true } }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, email: true, role: true, createdAt: true, profilePicture: true }
    })
  ]);

  // Signups per day last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const signupsByDay = await prisma.user.groupBy({
    by: ['createdAt'],
    where: { createdAt: { gte: sevenDaysAgo } },
    _count: true,
  });

  return {
    users: { total: totalUsers, active: activeUsers, banned: bannedUsers, newToday: newUsersToday },
    tournaments: { total: totalTournaments, active: activeTournaments },
    posts: { total: totalPosts },
    games: { total: totalGames },
    recentSignups,
    signupsByDay,
  };
}

// ── Users ─────────────────────────────────────────────────────
export async function getAllUsers(page: number = 1, limit: number = 20, search?: string, role?: string) {
  const skip = (page - 1) * limit;
  const where: any = {};
  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (role) where.role = role;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, isBanned: true, banReason: true,
        profilePicture: true, lastLoginAt: true, loginCount: true,
        createdAt: true, updatedAt: true,
        googleId: true, discordId: true, facebookId: true, twitterId: true,
        _count: { select: { posts: true, comments: true, tournamentParticipations: true } }
      }
    }),
    prisma.user.count({ where })
  ]);

  return { users, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      posts: { take: 5, orderBy: { createdAt: 'desc' } },
      tournamentParticipations: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { tournament: { select: { name: true, status: true } } }
      },
      gameStats: { include: { game: { select: { name: true } } } },
      _count: { select: { posts: true, comments: true, tournamentParticipations: true } }
    }
  });
}

export async function updateUserRole(userId: string, role: 'USER' | 'MODERATOR' | 'ADMIN') {
  return prisma.user.update({ where: { id: userId }, data: { role } });
}

export async function banUser(userId: string, reason: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { isBanned: true, banReason: reason, isActive: false }
  });
}

export async function unbanUser(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { isBanned: false, banReason: null, isActive: true }
  });
}

export async function deleteUser(userId: string) {
  return prisma.user.delete({ where: { id: userId } });
}

// ── Tournaments (Admin view) ──────────────────────────────────
export async function getAllTournamentsAdmin(page: number = 1, limit: number = 20, status?: string) {
  const skip = (page - 1) * limit;
  const where: any = status ? { status } : {};
  const [tournaments, total] = await Promise.all([
    prisma.tournament.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        game: { select: { name: true, icon: true } },
        _count: { select: { participants: true } }
      }
    }),
    prisma.tournament.count({ where })
  ]);
  return { tournaments, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function updateTournamentStatus(id: string, status: string) {
  return prisma.tournament.update({ where: { id }, data: { status: status as any } });
}

export async function deleteTournamentAdmin(id: string) {
  return prisma.tournament.delete({ where: { id } });
}

// ── Posts (Moderation) ────────────────────────────────────────
export async function getAllPostsAdmin(page: number = 1, limit: number = 20, hidden?: boolean) {
  const skip = (page - 1) * limit;
  const where: any = {};
  if (hidden !== undefined) where.isHidden = hidden;
  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true, email: true, profilePicture: true } },
        _count: { select: { comments: true } }
      }
    }),
    prisma.post.count({ where })
  ]);
  return { posts, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function hidePost(postId: string) {
  return prisma.post.update({ where: { id: postId }, data: { isHidden: true } });
}

export async function unhidePost(postId: string) {
  return prisma.post.update({ where: { id: postId }, data: { isHidden: false } });
}

export async function pinPost(postId: string) {
  return prisma.post.update({ where: { id: postId }, data: { isPinned: true } });
}

export async function deletePostAdmin(postId: string) {
  return prisma.post.delete({ where: { id: postId } });
}

// ── Games (Admin) ─────────────────────────────────────────────
export async function getAllGamesAdmin() {
  return prisma.game.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { tournaments: true, gameStats: true } } }
  });
}
