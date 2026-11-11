CREATE TYPE "public"."rg_limit_kind" AS ENUM('deposit', 'loss', 'stake');--> statement-breakpoint
CREATE TYPE "public"."rg_limit_period" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TABLE "rg_limits" (
	"player_id" uuid NOT NULL,
	"kind" "rg_limit_kind" NOT NULL,
	"period" "rg_limit_period" NOT NULL,
	"amount" bigint,
	"pending_amount" bigint,
	"pending_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rg_limits_player_id_kind_period_pk" PRIMARY KEY("player_id","kind","period")
);
--> statement-breakpoint
CREATE TABLE "rg_settings" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"reality_check_minutes" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "excluded_until" timestamp with time zone;