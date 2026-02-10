CREATE TABLE "node_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"actor_type" varchar(20) NOT NULL,
	"actor_id" varchar(255),
	"action" varchar(50) NOT NULL,
	"content_before" jsonb,
	"content_after" jsonb,
	"diff" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "node_history" ADD CONSTRAINT "node_history_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_node_history_node_version" ON "node_history" USING btree ("node_id","version");--> statement-breakpoint
CREATE INDEX "idx_node_history_actor_type" ON "node_history" USING btree ("actor_type");--> statement-breakpoint
CREATE INDEX "idx_node_history_action" ON "node_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_node_history_created_at" ON "node_history" USING btree ("created_at");