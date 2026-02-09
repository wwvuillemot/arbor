CREATE TABLE "media_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"bucket" varchar(255) NOT NULL,
	"object_key" varchar(1024) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size" bigint NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255) DEFAULT 'user:system' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_media_node" ON "media_attachments" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "idx_media_bucket_key" ON "media_attachments" USING btree ("bucket","object_key");