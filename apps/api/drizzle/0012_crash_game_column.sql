CREATE TYPE "public"."crash_game" AS ENUM('metro-jet', 'longshot');--> statement-breakpoint
ALTER TABLE "crash_rounds" DROP CONSTRAINT "crash_rounds_number_unique";--> statement-breakpoint
-- Existing rounds are Metro Jet (the only crash game so far); the default exists only to backfill them.
ALTER TABLE "crash_rounds" ADD COLUMN "game" "crash_game" DEFAULT 'metro-jet' NOT NULL;--> statement-breakpoint
ALTER TABLE "crash_rounds" ALTER COLUMN "game" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "crash_rounds" ADD CONSTRAINT "crash_rounds_game_number_unique" UNIQUE("game","number");