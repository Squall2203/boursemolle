-- ============================================================
-- BourseMolle — RPC reset_portfolio
-- Remet le cash à initial_capital, supprime positions/transactions/snapshots
-- ============================================================

CREATE OR REPLACE FUNCTION public.reset_portfolio(p_portfolio_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier ownership
  IF NOT EXISTS (
    SELECT 1 FROM portfolios WHERE id = p_portfolio_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM positions      WHERE portfolio_id = p_portfolio_id;
  DELETE FROM transactions   WHERE portfolio_id = p_portfolio_id;
  DELETE FROM portfolio_snapshots WHERE portfolio_id = p_portfolio_id;

  UPDATE portfolios
  SET cash_balance = initial_capital,
      reset_at     = NOW()
  WHERE id = p_portfolio_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_portfolio(INTEGER) TO authenticated;
