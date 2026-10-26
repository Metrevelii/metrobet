CREATE TYPE "public"."promotion_category" AS ENUM('casino', 'sports', 'crash', 'general');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"category" "promotion_category" NOT NULL,
	"title" jsonb NOT NULL,
	"subtitle" jsonb NOT NULL,
	"cta_label" jsonb NOT NULL,
	"cta_href" text,
	"content" jsonb NOT NULL,
	"terms" jsonb NOT NULL,
	"image_desktop" text NOT NULL,
	"image_mobile" text NOT NULL,
	"placements" text[] NOT NULL,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");