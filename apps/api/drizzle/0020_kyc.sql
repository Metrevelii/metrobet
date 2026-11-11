CREATE TYPE "public"."id_document_type" AS ENUM('id_card', 'passport');--> statement-breakpoint
CREATE TYPE "public"."kyc_check_status" AS ENUM('started', 'review', 'approved', 'rejected', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."kyc_rejection" AS ENUM('dob_mismatch', 'underage', 'duplicate', 'document', 'other');--> statement-breakpoint
CREATE TABLE "kyc_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"status" "kyc_check_status" DEFAULT 'started' NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" text,
	"document_type" "id_document_type",
	"document_number" text,
	"first_name" text,
	"last_name" text,
	"personal_number" text,
	"date_of_birth" date,
	"rejection" "kyc_rejection",
	"note" text,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "personal_number" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "kyc_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD CONSTRAINT "kyc_checks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kyc_checks_player_idx" ON "kyc_checks" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE INDEX "kyc_checks_status_idx" ON "kyc_checks" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_personal_number_unique" UNIQUE("personal_number");