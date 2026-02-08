CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"encrypted_value" text NOT NULL,
	"iv" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255),
	"content" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar(255) DEFAULT 'user:system' NOT NULL,
	"updated_by" varchar(255) DEFAULT 'user:system' NOT NULL,
	"author_type" varchar(20) DEFAULT 'human',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_parent_id_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_app_settings_key" ON "app_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_nodes_parent" ON "nodes" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_nodes_type" ON "nodes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_nodes_slug" ON "nodes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_nodes_deleted_at" ON "nodes" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_user_preferences_key" ON "user_preferences" USING btree ("key");