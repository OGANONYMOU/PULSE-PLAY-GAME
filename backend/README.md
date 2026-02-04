# PulsePay Backend

A modernized, production-ready Node.js/Express backend for the PulsePay gaming platform with TypeScript, PostgreSQL, Prisma ORM, JWT authentication, and comprehensive API endpoints.

## Features

✨ **Core Features**
- User authentication (email/password & OAuth)
- Game management system
- Tournament system with participant tracking
- Community posts and comments
- User profiles and preferences
- Game statistics tracking

🔐 **Security**
- JWT-based authentication
- Password hashing with bcryptjs
- CORS protection
- Rate limiting
- Helmet security headers
- Input validation with Joi

📦 **Architecture**
- TypeScript for type safety
- Express.js HTTP server
- Prisma ORM for database
- PostgreSQL database
- Modular service/controller pattern
- Comprehensive error handling
- Middleware-based request processing

## Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL 12+

## Installation

1. **Clone and setup**
```bash
cd backend
npm install
```

2. **Environment Setup**
```bash
cp .env.example .env
```

3. **Update .env with your configuration**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/pulsepay_db
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
PORT=5000
NODE_ENV=development
```

4. **Setup Prisma**
```bash
# Generate Prisma client
npm run prisma:generate

# Create database and run migrations
npm run prisma:migrate

# Seed database with sample data
npm run seed
```

## Development

### Start development server
```bash
npm run dev
```

Server will run on `http://localhost:5000`

### Build for production
```bash
npm run build
```

### Start production server
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/signin` - Sign in with email/password
- `POST /api/auth/oauth/callback` - OAuth callback handler
- `GET /api/auth/profile` - Get authenticated user profile
- `PUT /api/auth/profile` - Update user profile

### Games
- `GET /api/games` - Get all games (paginated)
- `GET /api/games/:gameId` - Get specific game
- `GET /api/games/search?query=...` - Search games
- `GET /api/games/category/:category` - Get games by category
- `POST /api/games` - Create game (auth required)
- `PUT /api/games/:gameId` - Update game (auth required)
- `DELETE /api/games/:gameId` - Delete game (auth required)
- `POST /api/games/:gameId/stats` - Update game stats (auth required)

### Tournaments
- `GET /api/tournaments` - Get all tournaments
- `GET /api/tournaments?status=upcoming` - Filter by status
- `GET /api/tournaments/:tournamentId` - Get specific tournament
- `GET /api/tournaments/game/:gameId` - Get tournaments by game
- `POST /api/tournaments` - Create tournament (auth required)
- `PUT /api/tournaments/:tournamentId` - Update tournament (auth required)
- `POST /api/tournaments/:tournamentId/join` - Join tournament (auth required)
- `POST /api/tournaments/:tournamentId/leave` - Leave tournament (auth required)
- `DELETE /api/tournaments/:tournamentId` - Delete tournament (auth required)

### Community
- `GET /api/community/posts` - Get all posts (paginated)
- `GET /api/community/posts/:postId` - Get specific post
- `GET /api/community/user/:userId/posts` - Get user posts
- `POST /api/community/posts` - Create post (auth required)
- `PUT /api/community/posts/:postId` - Update post (auth required)
- `DELETE /api/community/posts/:postId` - Delete post (auth required)
- `POST /api/community/posts/:postId/like` - Like post
- `POST /api/community/posts/:postId/comments` - Add comment (auth required)
- `DELETE /api/community/comments/:commentId` - Delete comment (auth required)

## Database Schema

### Users
- Basic authentication (email, username, password)
- OAuth provider IDs (Google, Discord, Facebook, Twitter)
- User preferences (theme, notifications)
- Profile information (name, phone, bio, picture)

### Games
- Game metadata (name, category, description)
- Player statistics tracking

### Tournaments
- Tournament management with game association
- Participant tracking with ranking
- Prize pool and status management

### Community
- Posts with likes and comments
- User-generated content
- Community engagement

## Middleware

### Authentication (`auth.ts`)
- JWT token verification
- Request enrichment with user data

### Error Handling (`error.ts`)
- Global error handler
- Async error wrapper
- Standardized error responses

### Validation (`validation.ts`)
- Request body validation
- Query parameter validation
- Joi schema-based validation

## Services Layer

Each service encapsulates business logic:
- `AuthService` - User authentication and management
- `GameService` - Game operations and statistics
- `TournamentService` - Tournament management
- `CommunityService` - Posts and community features

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── environment.ts
│   │   ├── database.ts
│   │   └── jwt.ts
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript types
│   └── index.ts         # Application entry point
├── prisma/              # Database schema and migrations
├── dist/                # Compiled JavaScript (generated)
├── .env.example         # Environment variables template
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies
└── README.md            # This file
```

## OAuth Configuration

To enable OAuth login, configure credentials in `.env`:

### Google
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### Discord
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create application and get credentials
3. Set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`

### Facebook
1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create app and get credentials
3. Set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`

### Twitter
1. Go to [Twitter Developer Portal](https://developer.twitter.com)
2. Create app and get credentials
3. Set `TWITTER_API_KEY` and `TWITTER_API_SECRET`

## Database Migrations

### Create a new migration
```bash
npm run prisma:migrate
```

### View database in Prisma Studio
```bash
npm run prisma:studio
```

### Push schema to database
```bash
npm run prisma:push
```

## Testing

```bash
npm test
```

## Production Deployment

1. Build the application
```bash
npm run build
```

2. Update `.env` with production values
```env
NODE_ENV=production
DATABASE_URL=postgresql://...production...
JWT_SECRET=your_production_secret_key
```

3. Run migrations in production
```bash
npm run prisma:migrate
```

4. Start the server
```bash
npm start
```

## Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "status": 400,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Configurable via `RATE_LIMIT_*` environment variables

## CORS Configuration

Configure allowed origins in `.env`:
```
CORS_ORIGIN=http://localhost:3000,http://localhost:8000
```

## Contributing

1. Follow the established project structure
2. Use TypeScript for all new code
3. Add proper error handling
4. Include JSDoc comments for functions
5. Validate all inputs

## License

MIT

## Support

For issues and questions, please create an issue in the repository.
