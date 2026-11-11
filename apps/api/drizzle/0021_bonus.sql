CREATE TYPE "public"."bonus_status" AS ENUM('active', 'completed', 'forfeited', 'expired', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."wallet_account_kind" ADD VALUE 'bonus';--> statement-breakpoint
ALTER TYPE "public"."wallet_account_kind" ADD VALUE 'marketing';--> statement-breakpoint
ALTER TYPE "public"."wallet_transaction_type" ADD VALUE 'bonus_grant';--> statement-breakpoint
ALTER TYPE "public"."wallet_transaction_type" ADD VALUE 'bonus_convert';--> statement-breakpoint
ALTER TYPE "public"."wallet_transaction_type" ADD VALUE 'bonus_forfeit';--> statement-breakpoint
CREATE TABLE "bonuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"status" "bonus_status" DEFAULT 'active' NOT NULL,
	"amount" bigint NOT NULL,
	"wagering_required" bigint NOT NULL,
	"wagered" bigint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"grant_key" text NOT NULL,
	"promotion_id" uuid,
	"title" jsonb,
	"converted" bigint DEFAULT 0 NOT NULL,
	"forfeited" bigint DEFAULT 0 NOT NULL,
	"reason" text,
	"ended_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "bonuses_grant_key_unique" UNIQUE("grant_key")
);
--> statement-breakpoint
ALTER TABLE "wallet_accounts" DROP CONSTRAINT "wallet_accounts_owner_check";--> statement-breakpoint
ALTER TABLE "wallet_accounts" DROP CONSTRAINT "wallet_accounts_player_balance_check";--> statement-breakpoint
ALTER TABLE "bet_tickets" ADD COLUMN "bonus_stake" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD COLUMN "bonus_bet_total" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_transactions" ADD COLUMN "bonus_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bonuses_one_active_idx" ON "bonuses" USING btree ("player_id") WHERE "bonuses"."status" = 'active';--> statement-breakpoint
CREATE INDEX "bonuses_player_idx" ON "bonuses" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE INDEX "bonuses_expiry_idx" ON "bonuses" USING btree ("status","expires_at");--> statement-breakpoint
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_owner_check" CHECK (("wallet_accounts"."kind"::text in ('player', 'bonus')) = ("wallet_accounts"."player_id" is not null));--> statement-breakpoint
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_player_balance_check" CHECK ("wallet_accounts"."kind"::text not in ('player', 'bonus') or "wallet_accounts"."balance" >= 0);--> statement-breakpoint
-- Hand-written (drizzle-kit does not model triggers). The live balance players see is cash plus
-- bonus money: push that total whenever either account of a player changes. Compares kind as
-- text for the same reason as the checks above.
CREATE OR REPLACE FUNCTION notify_player_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    'player_balance',
    json_build_object(
      'playerId', NEW.player_id,
      'balance', (
        SELECT coalesce(sum(balance), 0) FROM wallet_accounts
        WHERE player_id = NEW.player_id AND kind::text IN ('player', 'bonus')
      )
    )::text
  );
  RETURN NULL;
END;
$$;--> statement-breakpoint
DROP TRIGGER wallet_accounts_notify_player_balance ON wallet_accounts;--> statement-breakpoint
CREATE TRIGGER wallet_accounts_notify_player_balance
  AFTER UPDATE OF balance ON wallet_accounts
  FOR EACH ROW
  WHEN (NEW.kind::text IN ('player', 'bonus') AND NEW.balance IS DISTINCT FROM OLD.balance)
  EXECUTE FUNCTION notify_player_balance();
