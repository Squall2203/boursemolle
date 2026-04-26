-- ============================================================
-- BourseMolle — V5 Sprint 4 : Leaderboard + Défis + Snapshots
-- Coller dans Supabase > SQL Editor > New query
-- ============================================================

-- 1. Ajouter created_at à stock_views si absent
ALTER TABLE public.stock_views
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Policy publique sur portfolio_snapshots (pour le leaderboard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portfolio_snapshots' AND policyname = 'snapshots_public_read'
  ) THEN
    CREATE POLICY "snapshots_public_read" ON public.portfolio_snapshots
      FOR SELECT USING (
        portfolio_id IN (SELECT id FROM public.portfolios WHERE is_public = true)
      );
  END IF;
END $$;

-- Policy publique sur users (pseudo + avatar pour le leaderboard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'users_public_read'
  ) THEN
    CREATE POLICY "users_public_read" ON public.users
      FOR SELECT USING (true);
  END IF;
END $$;

-- 3. RPC : get_leaderboard
-- Retourne le top 50 des portfolios publics par valeur totale (snapshot le plus récent)
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  user_id       UUID,
  pseudo        TEXT,
  avatar_url    TEXT,
  portfolio_id  INTEGER,
  portfolio_name TEXT,
  total_value   NUMERIC,
  initial_capital NUMERIC,
  performance   NUMERIC,
  snapshot_date DATE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    COALESCE(u.pseudo, split_part(u.email, '@', 1)) AS pseudo,
    u.avatar_url,
    p.id,
    p.name,
    latest.total_value,
    p.initial_capital,
    ROUND(((latest.total_value - p.initial_capital) / p.initial_capital * 100)::numeric, 2) AS performance,
    latest.snapshot_date
  FROM (
    SELECT DISTINCT ON (ps.portfolio_id)
      ps.portfolio_id,
      ps.total_value,
      ps.snapshot_date
    FROM portfolio_snapshots ps
    ORDER BY ps.portfolio_id, ps.snapshot_date DESC
  ) latest
  JOIN portfolios p ON p.id = latest.portfolio_id
    AND p.is_public = true
    AND p.is_active = true
  JOIN users u ON u.id = p.user_id
  ORDER BY latest.total_value DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;

-- 4. RPC : upsert_portfolio_snapshot
-- Appelé côté client quand le portfolio est chargé avec sa valeur calculée
CREATE OR REPLACE FUNCTION public.upsert_portfolio_snapshot(
  p_portfolio_id   INTEGER,
  p_total_value    NUMERIC,
  p_cash_balance   NUMERIC,
  p_positions_value NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_initial_capital NUMERIC;
  v_prev_value NUMERIC;
  v_daily_return NUMERIC;
  v_cumulative_return NUMERIC;
BEGIN
  -- Vérifier ownership (sécurité)
  IF NOT EXISTS (
    SELECT 1 FROM portfolios WHERE id = p_portfolio_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT initial_capital INTO v_initial_capital FROM portfolios WHERE id = p_portfolio_id;

  -- Retour journalier approximatif (snapshot de la veille)
  SELECT total_value INTO v_prev_value
  FROM portfolio_snapshots
  WHERE portfolio_id = p_portfolio_id AND snapshot_date = CURRENT_DATE - 1;

  v_daily_return := CASE WHEN v_prev_value IS NOT NULL AND v_prev_value > 0
    THEN ROUND(((p_total_value - v_prev_value) / v_prev_value * 100)::numeric, 4)
    ELSE NULL END;

  v_cumulative_return := CASE WHEN v_initial_capital > 0
    THEN ROUND(((p_total_value - v_initial_capital) / v_initial_capital * 100)::numeric, 4)
    ELSE 0 END;

  INSERT INTO portfolio_snapshots (
    portfolio_id, snapshot_date, total_value, cash_balance,
    positions_value, daily_return, cumulative_return
  )
  VALUES (
    p_portfolio_id, CURRENT_DATE, p_total_value, p_cash_balance,
    p_positions_value, v_daily_return, v_cumulative_return
  )
  ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE SET
    total_value      = EXCLUDED.total_value,
    cash_balance     = EXCLUDED.cash_balance,
    positions_value  = EXCLUDED.positions_value,
    daily_return     = EXCLUDED.daily_return,
    cumulative_return = EXCLUDED.cumulative_return;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_portfolio_snapshot(INTEGER, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

-- 5. RPC : seed_weekly_challenges
-- À appeler chaque lundi manuellement ou via un cron Edge Function.
-- Calcule automatiquement les dates de la semaine courante (lundi → dimanche).
CREATE OR REPLACE FUNCTION public.seed_weekly_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start TIMESTAMP WITH TIME ZONE;
  v_week_end   TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Lundi de la semaine courante à minuit UTC
  v_week_start := date_trunc('week', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_week_end   := v_week_start + INTERVAL '6 days 23 hours 59 minutes 59 seconds';

  INSERT INTO public.challenges (title, description, challenge_type, conditions, badge_id, starts_at, ends_at, is_active)
  VALUES
    (
      'Trader actif',
      'Exécutez 5 trades Paper PEA cette semaine.',
      'weekly',
      '{"metric": "weekly_trades", "target": 5, "xp": 50}'::jsonb,
      NULL, v_week_start, v_week_end, true
    ),
    (
      'Explorateur',
      'Consultez 10 fiches actions différentes cette semaine.',
      'weekly',
      '{"metric": "weekly_views", "target": 10, "xp": 30}'::jsonb,
      NULL, v_week_start, v_week_end, true
    ),
    (
      'Fidèle investisseur',
      'Connectez-vous 5 jours différents cette semaine.',
      'weekly',
      '{"metric": "weekly_logins", "target": 5, "xp": 40}'::jsonb,
      NULL, v_week_start, v_week_end, true
    )
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_weekly_challenges() TO authenticated;

-- Seeder immédiatement pour la semaine courante
SELECT public.seed_weekly_challenges();
