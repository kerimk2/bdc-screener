-- Add new financial metric columns to bdcs table
ALTER TABLE bdcs ADD COLUMN IF NOT EXISTS market_cap BIGINT;
ALTER TABLE bdcs ADD COLUMN IF NOT EXISTS payout_ratio DECIMAL;
ALTER TABLE bdcs ADD COLUMN IF NOT EXISTS beta DECIMAL;
ALTER TABLE bdcs ADD COLUMN IF NOT EXISTS fifty_two_week_high DECIMAL;
ALTER TABLE bdcs ADD COLUMN IF NOT EXISTS fifty_two_week_low DECIMAL;
ALTER TABLE bdcs ADD COLUMN IF NOT EXISTS analyst_target_price DECIMAL;
ALTER TABLE bdcs ADD COLUMN IF NOT EXISTS analyst_rating TEXT;
ALTER TABLE bdcs ADD COLUMN IF NOT EXISTS institutional_ownership DECIMAL;
ALTER TABLE bdcs ADD COLUMN IF NOT EXISTS five_yr_avg_dividend_yield DECIMAL;
ALTER TABLE bdcs ADD COLUMN IF NOT EXISTS ex_dividend_date DATE;

-- Add column comments
COMMENT ON COLUMN bdcs.market_cap IS 'Market capitalization in USD';
COMMENT ON COLUMN bdcs.payout_ratio IS 'Dividend payout ratio (0.90 = 90%)';
COMMENT ON COLUMN bdcs.beta IS 'Beta relative to S&P 500';
COMMENT ON COLUMN bdcs.fifty_two_week_high IS '52-week high price';
COMMENT ON COLUMN bdcs.fifty_two_week_low IS '52-week low price';
COMMENT ON COLUMN bdcs.analyst_target_price IS 'Mean analyst target price';
COMMENT ON COLUMN bdcs.analyst_rating IS 'Analyst consensus (buy/hold/sell)';
COMMENT ON COLUMN bdcs.institutional_ownership IS 'Institutional ownership percentage (0.85 = 85%)';
COMMENT ON COLUMN bdcs.five_yr_avg_dividend_yield IS '5-year average dividend yield percentage';
COMMENT ON COLUMN bdcs.ex_dividend_date IS 'Next ex-dividend date';

-- Insert missing publicly traded BDCs
INSERT INTO bdcs (cik, name, ticker) VALUES
  ('1747777', 'Blue Owl Technology Finance Corp.', 'OTF'),
  ('1782524', 'Morgan Stanley Direct Lending Fund', 'MSDL'),
  ('1747172', 'Kayne Anderson BDC, Inc.', 'KBDC'),
  ('1535778', 'MSC Income Fund, Inc.', 'MSIF'),
  ('1794776', 'Palmer Square Capital BDC Inc.', 'PSBD'),
  ('1372807', 'BCP Investment Corporation', 'BCIC')
ON CONFLICT (cik) DO UPDATE SET
  ticker = EXCLUDED.ticker,
  name = EXCLUDED.name;
