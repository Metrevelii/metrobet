-- Player live channel (src/modules/player-live). Hand-written: drizzle-kit does not model triggers.
-- NOTIFY is delivered only when the transaction commits, so rolled-back changes are never pushed.

-- A player's balance changed (any ledger transaction: bets, wins, cash-outs, deposits…).
CREATE FUNCTION notify_player_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    'player_balance',
    json_build_object('playerId', NEW.player_id, 'balance', NEW.balance)::text
  );
  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE TRIGGER wallet_accounts_notify_player_balance
  AFTER UPDATE OF balance ON wallet_accounts
  FOR EACH ROW
  WHEN (NEW.kind = 'player' AND NEW.balance IS DISTINCT FROM OLD.balance)
  EXECUTE FUNCTION notify_player_balance();--> statement-breakpoint

-- A sports ticket settled (won, lost, void). Cash-outs are left out: the player started them.
CREATE FUNCTION notify_ticket_settled() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    'ticket_settled',
    json_build_object(
      'ticketId', NEW.id,
      'playerId', NEW.player_id,
      'status', NEW.status,
      'mode', NEW.mode,
      'stake', NEW.stake,
      'payout', NEW.payout
    )::text
  );
  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE TRIGGER bet_tickets_notify_settled
  AFTER UPDATE OF status ON bet_tickets
  FOR EACH ROW
  WHEN (OLD.status = 'open' AND NEW.status IN ('won', 'lost', 'void'))
  EXECUTE FUNCTION notify_ticket_settled();
