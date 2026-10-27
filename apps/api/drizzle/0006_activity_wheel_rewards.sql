CREATE TYPE "public"."promo_reward_kind" AS ENUM('freeSpins');--> statement-breakpoint
CREATE TYPE "public"."promo_reward_status" AS ENUM('granted', 'credited');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"player_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_wheel_progress" (
	"promotion_id" uuid NOT NULL,
	"block_id" text NOT NULL,
	"player_id" uuid NOT NULL,
	"wagered" bigint DEFAULT 0 NOT NULL,
	"spins_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_wheel_progress_promotion_id_block_id_player_id_pk" PRIMARY KEY("promotion_id","block_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "promo_wheel_spins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promotion_id" uuid NOT NULL,
	"block_id" text NOT NULL,
	"player_id" uuid NOT NULL,
	"segment_index" integer NOT NULL,
	"free_spins" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"promotion_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_id" uuid NOT NULL,
	"kind" "promo_reward_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "promo_reward_status" DEFAULT 'granted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_rewards_source_unique" UNIQUE("source_id")
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_wheel_progress" ADD CONSTRAINT "promo_wheel_progress_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_wheel_progress" ADD CONSTRAINT "promo_wheel_progress_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_wheel_spins" ADD CONSTRAINT "promo_wheel_spins_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_wheel_spins" ADD CONSTRAINT "promo_wheel_spins_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_rewards" ADD CONSTRAINT "promo_rewards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_rewards" ADD CONSTRAINT "promo_rewards_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_player_idx" ON "activity_events" USING btree ("player_id","occurred_at");--> statement-breakpoint
CREATE INDEX "promo_wheel_spins_player_idx" ON "promo_wheel_spins" USING btree ("promotion_id","block_id","player_id","created_at");