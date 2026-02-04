import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create games
  const games = await Promise.all([
    prisma.game.create({
      data: {
        name: 'Counter-Strike 2',
        category: 'FPS',
        description: 'The ultimate competitive first-person shooter',
        players: 5000,
        rating: 4.8
      }
    }),
    prisma.game.create({
      data: {
        name: 'VALORANT',
        category: 'FPS',
        description: 'A 5v5 character-based tactical shooter',
        players: 4500,
        rating: 4.7
      }
    }),
    prisma.game.create({
      data: {
        name: 'League of Legends',
        category: 'MOBA',
        description: 'The most popular multiplayer online battle arena',
        players: 8000,
        rating: 4.6
      }
    }),
    prisma.game.create({
      data: {
        name: 'Dota 2',
        category: 'MOBA',
        description: 'Free-to-play team-based action RPG',
        players: 3500,
        rating: 4.5
      }
    }),
    prisma.game.create({
      data: {
        name: 'Call of Duty: Black Ops Cold War',
        category: 'FPS',
        description: 'Fast-paced multiplayer action',
        players: 3000,
        rating: 4.4
      }
    })
  ]);

  console.log(`✅ Created ${games.length} games`);

  // Create sample users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'player1@example.com',
        username: 'ProGamer',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+234123456789',
        password: 'hashedpassword123',
        profilePicture: 'https://api.example.com/avatars/1.png',
        bio: 'Competitive gamer | Esports enthusiast'
      }
    }),
    prisma.user.create({
      data: {
        email: 'player2@example.com',
        username: 'EsportsKing',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+234987654321',
        password: 'hashedpassword456',
        profilePicture: 'https://api.example.com/avatars/2.png',
        bio: 'Tournament player | FPS specialist'
      }
    })
  ]);

  console.log(`✅ Created ${users.length} users`);

  // Create tournaments
  const tournaments = await Promise.all([
    prisma.tournament.create({
      data: {
        name: 'CS2 Pro Tournament',
        gameId: games[0].id,
        description: 'A premier Counter-Strike 2 tournament',
        prizePool: 10000,
        maxParticipants: 16,
        status: 'upcoming',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    }),
    prisma.tournament.create({
      data: {
        name: 'VALORANT Champions League',
        gameId: games[1].id,
        description: 'Official VALORANT championship',
        prizePool: 20000,
        maxParticipants: 32,
        status: 'upcoming',
        startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      }
    })
  ]);

  console.log(`✅ Created ${tournaments.length} tournaments`);

  // Create game stats
  await Promise.all([
    prisma.gameStat.create({
      data: {
        userId: users[0].id,
        gameId: games[0].id,
        gamesPlayed: 150,
        wins: 85,
        losses: 65,
        highScore: 5000,
        totalPoints: 12500
      }
    }),
    prisma.gameStat.create({
      data: {
        userId: users[1].id,
        gameId: games[1].id,
        gamesPlayed: 200,
        wins: 110,
        losses: 90,
        highScore: 8000,
        totalPoints: 18000
      }
    })
  ]);

  console.log('✅ Created game stats');

  // Create sample posts
  const posts = await Promise.all([
    prisma.post.create({
      data: {
        userId: users[0].id,
        content: 'Just won an amazing match! Our team coordination was perfect 🎮',
        likes: 42
      }
    }),
    prisma.post.create({
      data: {
        userId: users[1].id,
        content: 'Excited for the upcoming tournament! Who else is registering? 🏆',
        likes: 128
      }
    })
  ]);

  console.log(`✅ Created ${posts.length} posts`);

  // Create comments
  await Promise.all([
    prisma.comment.create({
      data: {
        postId: posts[0].id,
        userId: users[1].id,
        content: 'Great performance! Well played 👏'
      }
    }),
    prisma.comment.create({
      data: {
        postId: posts[1].id,
        userId: users[0].id,
        content: 'Count me in! See you there 🎯'
      }
    })
  ]);

  console.log('✅ Created comments');

  console.log('🌱 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
