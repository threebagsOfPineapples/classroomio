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
--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "allow_makeup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "shuffle_questions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "shuffle_options" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "show_answers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "exercise" SET "allow_makeup" = true WHERE "is_exam" = true AND "max_attempts" > 1;
--> statement-breakpoint
CREATE TABLE "assessment_ai_suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"provider" varchar(100) NOT NULL,
	"overall_score" double precision NOT NULL,
	"dimensions" jsonb NOT NULL,
	"feedback" text NOT NULL,
	"confidence" double precision NOT NULL,
	"review_status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"reviewed_by_profile_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_ai_suggestion_score_valid" CHECK ("assessment_ai_suggestion"."overall_score" BETWEEN 0 AND 100),
	CONSTRAINT "assessment_ai_suggestion_confidence_valid" CHECK ("assessment_ai_suggestion"."confidence" BETWEEN 0 AND 1),
	CONSTRAINT "assessment_ai_suggestion_status_valid" CHECK ("assessment_ai_suggestion"."review_status" IN ('PENDING', 'ACCEPTED', 'REJECTED'))
);
--> statement-breakpoint
ALTER TABLE "assessment_ai_suggestion" ADD CONSTRAINT "assessment_ai_suggestion_submission_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_ai_suggestion" ADD CONSTRAINT "assessment_ai_suggestion_reviewer_fkey" FOREIGN KEY ("reviewed_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_ai_suggestion_submission_idx" ON "assessment_ai_suggestion" USING btree ("submission_id");
