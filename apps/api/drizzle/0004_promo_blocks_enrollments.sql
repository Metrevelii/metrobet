CREATE TABLE "promotion_enrollments" (
	"promotion_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_enrollments_promotion_id_player_id_pk" PRIMARY KEY("promotion_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "promotion_enrollments" ADD CONSTRAINT "promotion_enrollments_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_enrollments" ADD CONSTRAINT "promotion_enrollments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;