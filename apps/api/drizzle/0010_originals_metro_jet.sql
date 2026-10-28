CREATE TYPE "public"."jet_bet_status" AS ENUM('pending', 'placed', 'cashed', 'lost', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."jet_round_status" AS ENUM('betting', 'flying', 'crashed', 'void');--> statement-breakpoint
CREATE TABLE "jet_bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"player_key" text NOT NULL,
	"slot" integer NOT NULL,
	"amount" bigint NOT NULL,
	"auto_cashout" numeric(10, 2),
	"status" "jet_bet_status" DEFAULT 'pending' NOT NULL,
	"cashed_at" numeric(10, 2),
	"win" bigint DEFAULT 0 NOT NULL,
	"settled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jet_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"seed" text NOT NULL,
	"seed_hash" text NOT NULL,
	"crash_point" numeric(10, 2) NOT NULL,
	"status" "jet_round_status" DEFAULT 'betting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"crashed_at" timestamp with time zone,
	CONSTRAINT "jet_rounds_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "jet_bets" ADD CONSTRAINT "jet_bets_round_id_jet_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."jet_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jet_bets_unsettled_idx" ON "jet_bets" USING btree ("created_at") WHERE "jet_bets"."settled" = false;--> statement-breakpoint
CREATE INDEX "jet_bets_round_idx" ON "jet_bets" USING btree ("round_id");