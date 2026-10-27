ALTER TABLE "casino_games" ADD COLUMN "is_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "casino_providers" ADD COLUMN "is_available" boolean DEFAULT true NOT NULL;