ALTER TABLE "tags" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_project_id_nodes_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tags_project" ON "tags" USING btree ("project_id");
