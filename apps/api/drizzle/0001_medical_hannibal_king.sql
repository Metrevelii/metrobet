CREATE TYPE "public"."game_type" AS ENUM('slot', 'crash', 'table');--> statement-breakpoint
CREATE TYPE "public"."game_volatility" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "casino_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"provider_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "game_type" NOT NULL,
	"thumbnail" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"rtp" numeric(5, 2),
	"volatility" "game_volatility",
	"has_demo" boolean DEFAULT true NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"released_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "casino_games_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "casino_games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "casino_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "casino_providers_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "casino_providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "casino_games" ADD CONSTRAINT "casino_games_provider_id_casino_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."casino_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "casino_games_provider_idx" ON "casino_games" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "casino_games_popularity_idx" ON "casino_games" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "casino_games_type_idx" ON "casino_games" USING btree ("type");