-- ============================================================
-- BourseMolle — Migration Sprint 3 : XP + Badges
-- Coller dans Supabase > SQL Editor > New query
-- ============================================================

-- Tracking des fiches consultées (badges Explorateur / Encyclopédiste)
CREATE TABLE public.stock_views (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.stock_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_views_owner" ON public.stock_views
  FOR ALL USING (auth.uid() = user_id);

-- Index pour les requêtes de comptage
CREATE INDEX idx_stock_views_user ON public.stock_views(user_id);
CREATE INDEX idx_stock_views_user_ticker ON public.stock_views(user_id, ticker);

-- Fonction pour incrémenter l'XP et recalculer le niveau
CREATE OR REPLACE FUNCTION public.increment_user_xp(
    p_user_id UUID,
    p_amount INTEGER,
    p_action TEXT
)
RETURNS INTEGER AS $$
DECLARE
    new_xp INTEGER;
BEGIN
    UPDATE public.users
    SET xp = xp + p_amount
    WHERE id = p_user_id
    RETURNING xp INTO new_xp;

    UPDATE public.users SET level =
        CASE
            WHEN new_xp >= 50000 THEN 10
            WHEN new_xp >= 20000 THEN 9
            WHEN new_xp >= 10000 THEN 8
            WHEN new_xp >= 6000  THEN 7
            WHEN new_xp >= 3000  THEN 6
            WHEN new_xp >= 1500  THEN 5
            WHEN new_xp >= 700   THEN 4
            WHEN new_xp >= 300   THEN 3
            WHEN new_xp >= 100   THEN 2
            ELSE 1
        END
    WHERE id = p_user_id;

    INSERT INTO public.xp_log (user_id, action, xp_earned)
    VALUES (p_user_id, p_action, p_amount);

    RETURN new_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
