ALTER TABLE "tags" ADD COLUMN "entity_node_id" uuid;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_entity_node_id_nodes_id_fk" FOREIGN KEY ("entity_node_id") REFERENCES "public"."nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tags_entity_node" ON "tags" USING btree ("entity_node_id");