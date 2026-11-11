CREATE TYPE "public"."payment_kind" AS ENUM('deposit', 'withdrawal');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('tbc', 'bog');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled', 'rejected', 'expired');--> statement-breakpoint
ALTER TYPE "public"."wallet_account_kind" ADD VALUE 'withdrawals';--> statement-breakpoint
ALTER TYPE "public"."wallet_transaction_type" ADD VALUE 'withdrawal_reversal';--> statement-breakpoint
ALTER TYPE "public"."wallet_transaction_type" ADD VALUE 'payout';--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"kind" "payment_kind" NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"amount" bigint NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"card_id" uuid,
	"card_mask" text,
	"provider_reference" text,
	"reason" text,
	"decided_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "payments_withdrawal_card_check" CHECK ("payments"."kind" <> 'withdrawal' or "payments"."card_id" is not null),
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "saved_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"token" text NOT NULL,
	"mask" text NOT NULL,
	"brand" text NOT NULL,
	"expiry" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_cards_token_unique" UNIQUE("player_id","provider","token")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_card_id_saved_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."saved_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_player_idx" ON "payments" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_queue_idx" ON "payments" USING btree ("kind","status","created_at");