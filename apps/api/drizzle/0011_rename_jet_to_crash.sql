ALTER TYPE "public"."jet_bet_status" RENAME TO "crash_bet_status";--> statement-breakpoint
ALTER TYPE "public"."jet_round_status" RENAME TO "crash_round_status";--> statement-breakpoint
ALTER TABLE "jet_bets" RENAME TO "crash_bets";--> statement-breakpoint
ALTER TABLE "jet_rounds" RENAME TO "crash_rounds";--> statement-breakpoint
ALTER TABLE "crash_rounds" DROP CONSTRAINT "jet_rounds_number_unique";--> statement-breakpoint
ALTER TABLE "crash_bets" DROP CONSTRAINT "jet_bets_round_id_jet_rounds_id_fk";
--> statement-breakpoint
DROP INDEX "jet_bets_unsettled_idx";--> statement-breakpoint
DROP INDEX "jet_bets_round_idx";--> statement-breakpoint
ALTER TABLE "crash_bets" ADD CONSTRAINT "crash_bets_round_id_crash_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."crash_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crash_bets_unsettled_idx" ON "crash_bets" USING btree ("created_at") WHERE "crash_bets"."settled" = false;--> statement-breakpoint
CREATE INDEX "crash_bets_round_idx" ON "crash_bets" USING btree ("round_id");--> statement-breakpoint
ALTER TABLE "crash_rounds" ADD CONSTRAINT "crash_rounds_number_unique" UNIQUE("number");