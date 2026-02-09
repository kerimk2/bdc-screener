-- =============================================================================
-- BDC Data Cleanup Migration
-- Fixes wrong tickers, removes defunct/merged BDCs, removes non-BDCs,
-- deduplicates entries, and nulls out non-traded BDC tickers.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Fix wrong ticker mappings
-- These tickers collide with unrelated public companies on Yahoo Finance.
-- Set ticker to NULL and clear stale financial data.
-- ---------------------------------------------------------------------------
UPDATE bdcs SET
  ticker = NULL,
  price = NULL, market_cap = NULL, dividend_yield = NULL,
  nav_per_share = NULL, price_to_nav = NULL, debt_to_equity = NULL,
  payout_ratio = NULL, beta = NULL, fifty_two_week_high = NULL,
  fifty_two_week_low = NULL, analyst_target_price = NULL,
  analyst_rating = NULL, institutional_ownership = NULL,
  five_yr_avg_dividend_yield = NULL, ex_dividend_date = NULL
WHERE ticker IN (
  'CLS',   -- Crestline Lending Solutions -> pulls Celestica Inc
  'BCPC',  -- BC Partners Lending -> pulls Balchem Corp
  'STEP',  -- Stepstone Private Credit -> pulls StepStone Group
  'GDLC',  -- Golub Capital Direct Lending -> pulls Grayscale Crypto ETF
  'HPS',   -- HPS Corporate Lending -> pulls John Hancock Fund
  'MBDC',  -- Muzinich BDC -> pulls MA Business Dev Corp
  'ADS'    -- Apollo Debt Solutions -> pulls Alliance Data Systems
);
-- Note: JCPB, BSLN, SUNS, TCFC handled by DELETE in step 2 (they're defunct)

-- ---------------------------------------------------------------------------
-- STEP 2: Delete defunct/merged BDCs
-- These companies no longer exist. Their successors are already in the DB.
-- Also deletes their holdings to avoid FK constraint violations.
-- ---------------------------------------------------------------------------
DELETE FROM holdings WHERE bdc_cik IN (
  '0001310222', '0001326003',  -- BlackRock Capital Investment (BKCC) -> merged into TCPC
  '0001278752',                -- Apollo Investment Corp (AINV) -> renamed to MFIC
  '0001523530',                -- SLR Senior Investment (SUNS) -> merged into SLRC
  '0001544206'                 -- TCG BDC (TCFC) -> renamed to Carlyle Secured Lending (CGBD)
);
-- Note: only deleting holdings for CIKs that actually had holdings.
-- The rest (ORCC, FULL, FCRD, etc.) have no holdings so direct BDC delete is safe.

DELETE FROM bdcs WHERE cik IN (
  '0001310222', '0001326003',  -- BlackRock Capital Investment (BKCC x2) -> TCPC
  '0001278752',                -- Apollo Investment Corp (AINV) -> MFIC
  '0001523530',                -- SLR Senior Investment (SUNS) -> SLRC
  '0001544206'                 -- TCG BDC (TCFC) -> CGBD (CIK 0001655125)
);

-- Defunct BDCs without holdings (safe to delete directly)
DELETE FROM bdcs WHERE ticker IN (
  'ORCC',  -- Blue Owl Capital Corp III -> merged into OBDC
  'FULL',  -- Full Circle Capital -> merged into GECC
  'FCRD',  -- First Eagle Alternative Capital -> merged into CCAP
  'MCGC',  -- MCG Capital -> merged into PFLT
  'KCAP',  -- Kohlberg Capital -> became BCIC
  'TICC',  -- TICC Capital -> renamed to OXSQ
  'TCRD',  -- THL Credit -> merged into CCAP
  'HCAP',  -- Harvest Capital Credit -> merged into BCIC
  'CPTA',  -- Capitala Finance -> merged into BCIC
  'CMFN',  -- CM Finance -> renamed to ICMB
  'PTMN',  -- Portman Ridge Finance -> renamed to BCIC
  'LRFC'   -- Logan Ridge Finance -> merged into BCIC
);

-- ---------------------------------------------------------------------------
-- STEP 3: Remove non-BDC entities (REITs, closed-end funds)
-- ---------------------------------------------------------------------------
DELETE FROM holdings WHERE bdc_cik IN (
  '0001529377',  -- ACRE (Ares Commercial Real Estate - mortgage REIT)
  '0001547459',  -- ARDC (Ares Dynamic Credit Allocation - closed-end fund)
  '0001790979',  -- EIC  (Eagle Point Income - closed-end CLO fund)
  '0001631256',  -- KREF (KKR Real Estate Finance Trust - mortgage REIT)
  '0001782879'   -- NREF (NexPoint Real Estate Finance - mortgage REIT)
);
DELETE FROM bdcs WHERE cik IN (
  '0001529377',  -- ACRE
  '0001547459',  -- ARDC
  '0001790979',  -- EIC
  '0001631256',  -- KREF
  '0001782879'   -- NREF
);

-- ---------------------------------------------------------------------------
-- STEP 4: Remove duplicate entries (keep the one with data/lower CIK)
-- ---------------------------------------------------------------------------
-- Delete holdings for duplicate CIKs being removed
DELETE FROM holdings WHERE bdc_cik IN (
  '0001520697',  -- BlackRock TCP Capital (dup, keep 0001370755)
  '0001544206',  -- Carlyle Secured Lending (dup, keep 0001655125) -- already deleted above
  '0001504619',  -- PhenixFIN Corp (dup, keep 0001490349)
  '0001837492',  -- Nuveen Churchill (dup, keep 0001737924)
  '0001552198',  -- WhiteHorse Finance (dup, keep 0001527590)
  '0001675033',  -- Great Elm Capital (dup, keep 0001662691)
  '0001828748',  -- Golub Capital BDC 3 (dup, keep 0001715268)
  '0001587650',  -- Newtek Business Services (no longer a BDC)
  '0001587987'   -- NewtekOne (no longer a BDC)
);
DELETE FROM bdcs WHERE cik IN (
  '0001520697',  -- BlackRock TCP Capital (dup)
  '0001504619',  -- PhenixFIN Corp (dup)
  '0001837492',  -- Nuveen Churchill (dup)
  '0001552198',  -- WhiteHorse Finance (dup)
  '0001675033',  -- Great Elm Capital (dup)
  '0001828748',  -- Golub Capital BDC 3 (dup)
  '0001587650',  -- Newtek Business Services
  '0001587987'   -- NewtekOne
);

-- ---------------------------------------------------------------------------
-- STEP 5: NULL tickers for non-traded/private BDCs
-- These are real BDCs but not publicly traded, so Yahoo Finance can't provide
-- data for them. Clear any stale data that may have been fetched incorrectly.
-- ---------------------------------------------------------------------------
UPDATE bdcs SET
  ticker = NULL,
  price = NULL, market_cap = NULL, dividend_yield = NULL,
  nav_per_share = NULL, price_to_nav = NULL, debt_to_equity = NULL,
  payout_ratio = NULL, beta = NULL, fifty_two_week_high = NULL,
  fifty_two_week_low = NULL, analyst_target_price = NULL,
  analyst_rating = NULL, institutional_ownership = NULL,
  five_yr_avg_dividend_yield = NULL, ex_dividend_date = NULL
WHERE ticker IN (
  '5CLP',    -- 5C Lending Partners
  'AGTB',    -- AG Twin Brook Capital Income
  'AMGC',    -- AMG Comvest Senior Lending
  'AOC2',    -- Apollo Origination II Capital Trust
  'ACIF',    -- Ares Core Infrastructure Fund
  'ASIF',    -- Ares Strategic Income Fund
  'BCPVT',   -- Bain Capital Private Credit
  'BPCC',    -- Barings Private Credit Corp
  'BPCF',    -- BlackRock Private Credit Fund
  'BCRED',   -- Blackstone Private Credit Fund
  'BPREC',   -- Blackstone Private Real Estate Credit
  'FPCC',    -- Fidelity Private Credit Co LLC
  'FPCF',    -- Fidelity Private Credit Fund
  'FEPC',    -- First Eagle Private Credit Fund
  'FBRED',   -- Franklin BSP Real Estate Debt BDC
  'GSML2',   -- Goldman Sachs Middle Market Lending II
  'GSPC',    -- Goldman Sachs Private Credit Corp
  'GSMM2',   -- Goldman Sachs Private Middle Market Credit II
  'GSREF',   -- Goldman Sachs Real Estate Finance Trust
  'GBDC3',   -- Golub Capital BDC 3
  'GBDC4',   -- Golub Capital BDC 4
  'GDLU',    -- Golub Capital Direct Lending Unlevered
  'GPCF',    -- Golub Capital Private Credit Fund
  'HPSCCS',  -- HPS Corporate Capital Solutions
  'JCPB',    -- Jefferies Credit Partners BDC
  'KEDL',    -- KKR Enhanced US Direct Lending
  'KFSI',    -- KKR FS Income Trust
  'KFSIS',   -- KKR FS Income Trust Select
  'LFSQ',    -- Lafayette Square USA
  'LAGO',    -- LAGO Evergreen Credit
  'MCIP',    -- Monroe Capital Income Plus
  'MCLIF',   -- Muzinich Corporate Lending Income
  'NCB5',    -- Nuveen Churchill BDC V
  'NCPC',    -- Nuveen Churchill Private Credit Fund
  'OSCF',    -- Oaktree Strategic Credit Fund
  'OVLD',    -- Overland Advantage
  'PGIM',    -- PGIM Private Credit Fund
  'SCP',     -- SCP Private Credit Income BDC
  'SLCAP',   -- Silver Capital Holdings
  'SPSF',    -- Silver Point Specialty Lending
  'SSPL',    -- Sixth Street Lending Partners
  'SLRHC',   -- SLR HC BDC LLC
  'SLRPC2',  -- SLR Private Credit BDC II
  'SCCP',    -- Steele Creek Capital Corp
  'SPCC',    -- Stone Point Credit Corp
  'SPCIF',   -- Stone Point Credit Income Fund
  'SPCIS',   -- Stone Point Credit Income Fund Select
  'VCSL',    -- Vista Credit Strategic Lending
  'WBDC',    -- West Bay BDC LLC
  'WILLOW',  -- Willow Tree Capital Corp
  'X1C'      -- X1 Capital Inc
);
