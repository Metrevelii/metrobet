CREATE TYPE "public"."wallet_account_kind" AS ENUM('player', 'house', 'funding');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_type" AS ENUM('deposit', 'withdrawal', 'bet', 'win', 'rollback', 'adjustment');--> statement-breakpoint
CREATE TABLE "wallet_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "wallet_account_kind" NOT NULL,
	"player_id" uuid,
	"currency" text NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_accounts_owner_unique" UNIQUE NULLS NOT DISTINCT("kind","player_id","currency"),
	CONSTRAINT "wallet_accounts_owner_check" CHECK (("wallet_accounts"."kind" = 'player') = ("wallet_accounts"."player_id" is not null)),
	CONSTRAINT "wallet_accounts_player_balance_check" CHECK ("wallet_accounts"."kind" <> 'player' or "wallet_accounts"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wallet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_entries_amount_check" CHECK ("wallet_entries"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"type" "wallet_transaction_type" NOT NULL,
	"player_id" uuid NOT NULL,
	"game_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_transaction_id_wallet_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_account_id_wallet_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."wallet_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_entries_account_idx" ON "wallet_entries" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "wallet_entries_transaction_idx" ON "wallet_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_player_idx" ON "wallet_transactions" USING btree ("player_id","created_at");