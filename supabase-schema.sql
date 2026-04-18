-- ============================================================
-- BourseMolle — Schema gamification V5
-- Coller dans Supabase > SQL Editor > New query
-- ============================================================

-- Profil public (lié à auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    pseudo VARCHAR(50) UNIQUE,
    avatar_url VARCHAR(500),
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE
);

-- Crée automatiquement un profil à chaque signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Paper PEA
CREATE TABLE public.portfolios (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(100) DEFAULT 'Mon Paper PEA',
    initial_capital DECIMAL(12,2) DEFAULT 100000.00,
    cash_balance DECIMAL(12,2) DEFAULT 100000.00,
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_at TIMESTAMP WITH TIME ZONE
);

-- Positions ouvertes
CREATE TABLE public.positions (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES public.portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    avg_price DECIMAL(10,4) NOT NULL,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Historique des transactions
CREATE TABLE public.transactions (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES public.portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
    quantity INTEGER NOT NULL,
    price DECIMAL(10,4) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Snapshots quotidiens (graphique de performance)
CREATE TABLE public.portfolio_snapshots (
    portfolio_id INTEGER REFERENCES public.portfolios(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_value DECIMAL(12,2) NOT NULL,
    cash_balance DECIMAL(12,2) NOT NULL,
    positions_value DECIMAL(12,2) NOT NULL,
    daily_return DECIMAL(8,4),
    cumulative_return DECIMAL(8,4),
    PRIMARY KEY (portfolio_id, snapshot_date)
);

-- Badges gagnés
CREATE TABLE public.user_badges (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id VARCHAR(50) NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    context JSONB,
    PRIMARY KEY (user_id, badge_id)
);

-- Log XP (anti-triche + debug)
CREATE TABLE public.xp_log (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    xp_earned INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Défis
CREATE TABLE public.challenges (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    challenge_type VARCHAR(20) CHECK (challenge_type IN ('weekly', 'monthly', 'annual')),
    conditions JSONB NOT NULL,
    badge_id VARCHAR(50),
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE public.user_challenges (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    challenge_id INTEGER REFERENCES public.challenges(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    progress JSONB,
    PRIMARY KEY (user_id, challenge_id)
);

-- Leaderboard (matérialisé quotidiennement)
CREATE TABLE public.leaderboard (
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('monthly', 'annual')),
    period_key VARCHAR(20) NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    portfolio_id INTEGER REFERENCES public.portfolios(id) ON DELETE CASCADE,
    rank INTEGER,
    performance DECIMAL(8,4),
    avg_score DECIMAL(3,1),
    position_count INTEGER,
    PRIMARY KEY (period_type, period_key, user_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- users : chaque user voit son propre profil
CREATE POLICY "users_own" ON public.users
  FOR ALL USING (auth.uid() = id);

-- portfolios : owner uniquement (+ lecture si public)
CREATE POLICY "portfolios_owner" ON public.portfolios
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "portfolios_public_read" ON public.portfolios
  FOR SELECT USING (is_public = true);

-- positions, transactions, snapshots : via portfolio
CREATE POLICY "positions_owner" ON public.positions
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid())
  );

CREATE POLICY "transactions_owner" ON public.transactions
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid())
  );

CREATE POLICY "snapshots_owner" ON public.portfolio_snapshots
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid())
  );

-- badges + xp : owner
CREATE POLICY "badges_owner" ON public.user_badges
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "xp_owner" ON public.xp_log
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "challenges_owner" ON public.user_challenges
  FOR ALL USING (auth.uid() = user_id);

-- challenges : lecture publique (tout le monde voit les défis disponibles)
CREATE POLICY "challenges_read" ON public.challenges
  FOR SELECT USING (true);

-- leaderboard : lecture publique
CREATE POLICY "leaderboard_read" ON public.leaderboard
  FOR SELECT USING (true);
