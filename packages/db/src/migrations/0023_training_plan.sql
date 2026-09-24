CREATE TYPE "public"."TRAINING_ENROLLMENT_STATUS" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."TRAINING_PLAN_STATUS" AS ENUM('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."TRAINING_PLAN_TYPE" AS ENUM('ANNUAL', 'QUARTERLY', 'MONTHLY', 'ONBOARDING', 'SPECIAL', 'MANDATORY', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."TRAINING_RESULT" AS ENUM('PENDING', 'PASS', 'FAIL', 'MAKEUP_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."TRAINING_TARGET_TYPE" AS ENUM('DEPARTMENT', 'POSITION', 'USER');--> statement-breakpoint
CREATE TABLE "training_enrollment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"member_id" bigint NOT NULL,
	"status" "TRAINING_ENROLLMENT_STATUS" DEFAULT 'NOT_STARTED' NOT NULL,
	"result" "TRAINING_RESULT" DEFAULT 'PENDING' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"progress_percent" integer,
	"final_score" double precision,
	"matched_target_ids" uuid[] NOT NULL,
	"plan_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_enrollment_plan_member_unique" UNIQUE("plan_id","member_id"),
	CONSTRAINT "training_enrollment_progress_valid" CHECK ("training_enrollment"."progress_percent" IS NULL OR "training_enrollment"."progress_percent" BETWEEN 0 AND 100),
	CONSTRAINT "training_enrollment_score_valid" CHECK ("training_enrollment"."final_score" IS NULL OR "training_enrollment"."final_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "training_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(64) NOT NULL,
	"description" text,
	"year" integer NOT NULL,
	"plan_type" "TRAINING_PLAN_TYPE" NOT NULL,
	"owner_member_id" bigint NOT NULL,
	"department_id" uuid,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "TRAINING_PLAN_STATUS" DEFAULT 'DRAFT' NOT NULL,
	"pass_score" integer,
	"published_at" timestamp with time zone,
	"published_by_profile_id" uuid,
	"created_by_profile_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_plan_org_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "training_plan_dates_valid" CHECK ("training_plan"."end_at" >= "training_plan"."start_at"),
	CONSTRAINT "training_plan_pass_score_valid" CHECK ("training_plan"."pass_score" IS NULL OR "training_plan"."pass_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "training_plan_course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"due_at" timestamp with time zone,
	CONSTRAINT "training_plan_course_unique" UNIQUE("plan_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "training_plan_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"target_type" "TRAINING_TARGET_TYPE" NOT NULL,
	"department_id" uuid,
	"position" varchar(128),
	"member_id" bigint,
	"include_descendants" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_plan_target_value_valid" CHECK (("training_plan_target"."target_type" = 'DEPARTMENT' AND "training_plan_target"."department_id" IS NOT NULL AND "training_plan_target"."position" IS NULL AND "training_plan_target"."member_id" IS NULL) OR ("training_plan_target"."target_type" = 'POSITION' AND "training_plan_target"."department_id" IS NULL AND "training_plan_target"."position" IS NOT NULL AND "training_plan_target"."member_id" IS NULL) OR ("training_plan_target"."target_type" = 'USER' AND "training_plan_target"."department_id" IS NULL AND "training_plan_target"."position" IS NULL AND "training_plan_target"."member_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD CONSTRAINT "training_enrollment_member_fkey" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD CONSTRAINT "training_enrollment_plan_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_owner_fkey" FOREIGN KEY ("organization_id","owner_member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_department_fkey" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."department"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_created_by_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_published_by_fkey" FOREIGN KEY ("published_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_course" ADD CONSTRAINT "training_plan_course_plan_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_course" ADD CONSTRAINT "training_plan_course_course_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_target" ADD CONSTRAINT "training_plan_target_plan_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_target" ADD CONSTRAINT "training_plan_target_department_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_target" ADD CONSTRAINT "training_plan_target_member_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."organizationmember"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_training_enrollment_org_member" ON "training_enrollment" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE INDEX "idx_training_enrollment_plan_status" ON "training_enrollment" USING btree ("plan_id","status");--> statement-breakpoint
CREATE INDEX "idx_training_plan_org_status" ON "training_plan" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_training_plan_course_plan" ON "training_plan_course" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_training_plan_target_plan" ON "training_plan_target" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_plan_target_department_unique" ON "training_plan_target" USING btree ("plan_id","department_id") WHERE "training_plan_target"."target_type" = 'DEPARTMENT';--> statement-breakpoint
CREATE UNIQUE INDEX "training_plan_target_position_unique" ON "training_plan_target" USING btree ("plan_id","position") WHERE "training_plan_target"."target_type" = 'POSITION';--> statement-breakpoint
CREATE UNIQUE INDEX "training_plan_target_member_unique" ON "training_plan_target" USING btree ("plan_id","member_id") WHERE "training_plan_target"."target_type" = 'USER';