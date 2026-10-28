CREATE TYPE "public"."game_round_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."game_transaction_kind" AS ENUM('bet', 'win', 'rollback');--> statement-breakpoint
CREATE TABLE "casino_game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"player_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "casino_game_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "game_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"game_slug" text NOT NULL,
	"external_id" text NOT NULL,
	"status" "game_round_status" DEFAULT 'open' NOT NULL,
	"bet_total" bigint DEFAULT 0 NOT NULL,
	"win_total" bigint DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "game_rounds_external_unique" UNIQUE("game_slug","external_id")
);
--> statement-breakpoint
CREATE TABLE "game_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"kind" "game_transaction_kind" NOT NULL,
	"round_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"rollback_of" text,
	"wallet_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_transactions_external_unique" UNIQUE("external_id"),
	CONSTRAINT "game_transactions_rollback_of_unique" UNIQUE("rollback_of"),
	CONSTRAINT "game_transactions_amount_check" CHECK ("game_transactions"."amount" >= 0),
	CONSTRAINT "game_transactions_rollback_check" CHECK (("game_transactions"."kind" = 'rollback') = ("game_transactions"."rollback_of" is not null))
);
--> statement-breakpoint
ALTER TABLE "casino_games" ADD COLUMN "has_real_money" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "casino_game_sessions" ADD CONSTRAINT "casino_game_sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casino_game_sessions" ADD CONSTRAINT "casino_game_sessions_game_id_casino_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."casino_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_session_id_casino_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."casino_game_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_transactions" ADD CONSTRAINT "game_transactions_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_transactions" ADD CONSTRAINT "game_transactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_transactions" ADD CONSTRAINT "game_transactions_wallet_transaction_id_wallet_transactions_id_fk" FOREIGN KEY ("wallet_transaction_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_rounds_player_idx" ON "game_rounds" USING btree ("player_id","opened_at");--> statement-breakpoint
CREATE INDEX "game_transactions_round_idx" ON "game_transactions" USING btree ("round_id");