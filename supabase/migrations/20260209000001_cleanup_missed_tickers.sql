-- Fix 2 tickers missed in the previous cleanup migration
-- TCFC (TCG BDC -> renamed to Carlyle Secured Lending, CGBD already in DB)
-- BSLN (Blue Owl Corp II -> merged into OBDC, already in DB)

DELETE FROM bdcs WHERE cik IN (
  '0001655762',  -- TCG BDC (TCFC) - duplicate of Carlyle Secured Lending (CGBD)
  '0001889539'   -- Blue Owl Capital Corp II (BSLN) - merged into OBDC
);
