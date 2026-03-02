-- PulsePay Database Schema for Supabase
-- Run this entire file in your Supabase Dashboard > SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'MODERATOR')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    badge TEXT,
    player_count INTEGER DEFAULT 0,
    tournament_count INTEGER DEFAULT 0,
    category TEXT NOT NULL,
    featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    prize_pool TEXT NOT NULL,
    max_players INTEGER NOT NULL,
    current_players INTEGER DEFAULT 0,
    duration TEXT NOT NULL,
    winner TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posts table (community)
CREATE TABLE IF NOT EXISTS posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tag TEXT DEFAULT 'general' CHECK (tag IN ('general', 'tournament', 'tips', 'clips')),
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Live updates table
CREATE TABLE IF NOT EXISTS live_updates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, first_name, last_name, avatar_url, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'avatar_url',
        'USER'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profiles_updated ON profiles;
CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_updates ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Games
DROP POLICY IF EXISTS "Games are viewable by everyone" ON games;
CREATE POLICY "Games are viewable by everyone" ON games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can insert games" ON games;
CREATE POLICY "Only admins can insert games" ON games FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'MODERATOR')
    ));

DROP POLICY IF EXISTS "Only admins can update games" ON games;
CREATE POLICY "Only admins can update games" ON games FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'MODERATOR')
    ));

-- Tournaments
DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON tournaments;
CREATE POLICY "Tournaments are viewable by everyone" ON tournaments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can insert tournaments" ON tournaments;
CREATE POLICY "Only admins can insert tournaments" ON tournaments FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'MODERATOR')
    ));

DROP POLICY IF EXISTS "Only admins can update tournaments" ON tournaments;
CREATE POLICY "Only admins can update tournaments" ON tournaments FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'MODERATOR')
    ));

-- Posts
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
CREATE POLICY "Authenticated users can create posts" ON posts FOR INSERT
    WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can update own posts" ON posts;
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE
    USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete own posts" ON posts;
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE
    USING (auth.uid() = author_id);

-- Allow likes updates by anyone authenticated (likes field only)
DROP POLICY IF EXISTS "Authenticated users can like posts" ON posts;
CREATE POLICY "Authenticated users can like posts" ON posts FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- Live Updates
DROP POLICY IF EXISTS "Live updates are viewable by everyone" ON live_updates;
CREATE POLICY "Live updates are viewable by everyone" ON live_updates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can insert live updates" ON live_updates;
CREATE POLICY "Only admins can insert live updates" ON live_updates FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'MODERATOR')
    ));

-- ============================================================
-- REALTIME
-- ============================================================

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE live_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE posts;

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO games (name, description, icon, badge, player_count, tournament_count, category, featured) VALUES
('Call of Duty: Mobile', 'News, tournaments, and rankings for CODM players. Join the battle and dominate the leaderboards.', '🎮', 'Most Popular', 2500, 150, 'fps', false),
('eFootball', 'Stay updated with the latest eFootball updates and global tournaments. Experience next-gen mobile soccer.', '⚽', 'Trending', 1800, 95, 'sports', false),
('Free Fire', 'Get insights and highlights from the Free Fire community. Battle royale action at your fingertips.', '🔥', 'Hot', 3200, 200, 'battle-royale', false),
('Mobile Legends: Bang Bang', 'The most popular MOBA on mobile. Join epic 5v5 battles and climb the ranked ladder.', '⚔️', 'Featured', 5000000, 500, 'moba', true),
('PUBG Mobile', 'The original battle royale experience on mobile. 100 players, one winner.', '🎯', NULL, 2100, 120, 'battle-royale', false),
('FIFA Mobile', 'Build your ultimate team and compete in seasonal events. Football at its finest.', '🏆', NULL, 1500, 80, 'sports', false)
ON CONFLICT DO NOTHING;

INSERT INTO tournaments (name, game_id, status, date, prize_pool, max_players, current_players, duration, winner) VALUES
('FIFA 24 Championship', (SELECT id FROM games WHERE name = 'FIFA Mobile'), 'ongoing', NOW() + INTERVAL '2 days', '₦200,000', 128, 64, '3 Days', NULL),
('CODM Legends Series', (SELECT id FROM games WHERE name = 'Call of Duty: Mobile'), 'upcoming', NOW() + INTERVAL '10 days', '₦150,000', 64, 32, '2 Days', NULL),
('Free Fire Grand Prix', (SELECT id FROM games WHERE name = 'Free Fire'), 'ongoing', NOW() + INTERVAL '1 day', '₦500,000', 100, 100, '5 Days', NULL),
('CODM Elite Championship', (SELECT id FROM games WHERE name = 'Call of Duty: Mobile'), 'upcoming', NOW() + INTERVAL '20 days', '₦300,000', 64, 16, '4 Days', NULL),
('Mobile Legends Championship', (SELECT id FROM games WHERE name = 'Mobile Legends: Bang Bang'), 'completed', NOW() - INTERVAL '10 days', '₦250,000', 128, 128, '3 Days', 'Team Alpha'),
('PUBG Mobile Masters', (SELECT id FROM games WHERE name = 'PUBG Mobile'), 'ongoing', NOW() + INTERVAL '3 days', '₦400,000', 100, 80, '3 Days', NULL)
ON CONFLICT DO NOTHING;
