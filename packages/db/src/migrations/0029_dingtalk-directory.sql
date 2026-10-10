ALTER TABLE "department" ADD COLUMN "external_source" varchar(64);
--> statement-breakpoint
ALTER TABLE "department" ADD COLUMN "external_id" varchar(128);
--> statement-breakpoint
CREATE UNIQUE INDEX "department_org_external_id_unique" ON "department" ("organization_id", "external_source", "external_id") WHERE "external_source" IS NOT NULL AND "external_id" IS NOT NULL;
