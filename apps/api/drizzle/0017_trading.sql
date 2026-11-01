CREATE TYPE "public"."trading_suspension_scope" AS ENUM('event', 'market');--> statement-breakpoint
CREATE TYPE "public"."trading_rule_scope" AS ENUM('sport', 'competition');--> statement-breakpoint
CREATE TABLE "trading_rules" (
	"scope" "trading_rule_scope" NOT NULL,
	"key" text NOT NULL,
	"margin" numeric(4, 1),
	"max_stake" bigint,
	"max_payout" bigint,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trading_rules_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "trading_suspensions" (
	"target_id" text PRIMARY KEY NOT NULL,
	"scope" "trading_suspension_scope" NOT NULL,
	"event_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
