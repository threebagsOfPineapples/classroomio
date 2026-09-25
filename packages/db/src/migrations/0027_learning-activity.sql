CREATE TABLE "learning_activity_minute" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"minute_at" timestamp with time zone NOT NULL,
	CONSTRAINT "learning_activity_minute_org_profile_time_unique" UNIQUE("organization_id","profile_id","minute_at")
);
--> statement-breakpoint
ALTER TABLE "learning_activity_minute" ADD CONSTRAINT "learning_activity_minute_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_activity_minute" ADD CONSTRAINT "learning_activity_minute_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_activity_minute" ADD CONSTRAINT "learning_activity_minute_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_learning_activity_minute_course" ON "learning_activity_minute" USING btree ("course_id");