-- Ledger guards (see src/modules/wallet/CLAUDE.md). Hand-written: drizzle-kit does not model triggers.

-- Invariant 2: at commit, every transaction has at least two entries and they sum to zero.
CREATE FUNCTION wallet_check_transaction_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  tx_id uuid;
  legs integer;
  total numeric;
BEGIN
  -- Separate branches: PL/pgSQL resolves NEW's fields per statement, not per CASE arm.
  IF TG_TABLE_NAME = 'wallet_entries' THEN
    tx_id := NEW.transaction_id;
  ELSE
    tx_id := NEW.id;
  END IF;
  SELECT count(*), coalesce(sum(amount), 0) INTO legs, total
    FROM wallet_entries WHERE transaction_id = tx_id;
  IF legs < 2 OR total <> 0 THEN
    RAISE EXCEPTION 'wallet transaction % is unbalanced (% entries, sum %)', tx_id, legs, total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE CONSTRAINT TRIGGER wallet_entries_balanced
  AFTER INSERT ON wallet_entries DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION wallet_check_transaction_balanced();--> statement-breakpoint

CREATE CONSTRAINT TRIGGER wallet_transactions_balanced
  AFTER INSERT ON wallet_transactions DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION wallet_check_transaction_balanced();--> statement-breakpoint

-- Invariant 3: transactions and entries are append-only.
CREATE FUNCTION wallet_reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: post a compensating transaction instead', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint

CREATE TRIGGER wallet_entries_append_only
  BEFORE UPDATE OR DELETE ON wallet_entries
  FOR EACH ROW EXECUTE FUNCTION wallet_reject_change();--> statement-breakpoint

CREATE TRIGGER wallet_transactions_append_only
  BEFORE UPDATE OR DELETE ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION wallet_reject_change();
