-- Move the old fixed fields into page blocks (rich text, then terms) before dropping them.
UPDATE "promotions" SET "blocks" = jsonb_build_array(
	jsonb_build_object('id', gen_random_uuid()::text, 'type', 'richText', 'title', null, 'body', "content"),
	jsonb_build_object('id', gen_random_uuid()::text, 'type', 'terms', 'body', "terms")
) WHERE "blocks" = '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "promotions" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "promotions" DROP COLUMN "terms";
