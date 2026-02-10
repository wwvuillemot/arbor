CREATE TABLE "agent_modes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"allowed_tools" jsonb NOT NULL,
	"guidelines" text NOT NULL,
	"temperature" numeric(3, 2) NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_modes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE INDEX "idx_agent_modes_name" ON "agent_modes" USING btree ("name");