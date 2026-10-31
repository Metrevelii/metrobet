CREATE TYPE "public"."bet_market_type" AS ENUM('1x2', 'double_chance', 'total', 'btts', 'moneyline', 'spread', 'set_winner');--> statement-breakpoint
CREATE TYPE "public"."bet_mode" AS ENUM('single', 'combo');--> statement-breakpoint
CREATE TYPE "public"."bet_selection_key" AS ENUM('home', 'draw', 'away', 'over', 'under', 'yes', 'no', 'home_draw', 'home_away', 'draw_away');--> statement-breakpoint
CREATE TYPE "public"."bet_sport" AS ENUM('football', 'basketball', 'tennis');--> statement-breakpoint
CREATE TYPE "public"."bet_selection_result" AS ENUM('won', 'lost', 'void');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'won', 'lost', 'void');--> statement-breakpoint
CREATE TABLE "bet_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"selection_id" text NOT NULL,
	"event_id" text NOT NULL,
	"sport" "bet_sport" NOT NULL,
	"competition" text NOT NULL,
	"home" text NOT NULL,
	"away" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"market_type" "bet_market_type" NOT NULL,
	"line" numeric(6, 1),
	"selection_key" "bet_selection_key" NOT NULL,
	"odds" numeric(8, 2) NOT NULL,
	"result" "bet_selection_result",
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bet_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"request_index" integer NOT NULL,
	"mode" "bet_mode" NOT NULL,
	"stake" bigint NOT NULL,
	"odds" numeric(14, 2) NOT NULL,
	"potential_win" bigint NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"payout" bigint DEFAULT 0 NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "bet_tickets_request_unique" UNIQUE("request_key","request_index")
);
--> statement-breakpoint
ALTER TABLE "bet_selections" ADD CONSTRAINT "bet_selections_ticket_id_bet_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."bet_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_tickets" ADD CONSTRAINT "bet_tickets_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bet_selections_ticket_idx" ON "bet_selections" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "bet_selections_open_event_idx" ON "bet_selections" USING btree ("event_id") WHERE "bet_selections"."result" is null;--> statement-breakpoint
CREATE INDEX "bet_tickets_player_idx" ON "bet_tickets" USING btree ("player_id","placed_at");