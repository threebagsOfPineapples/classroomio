CREATE TYPE "public"."TRAINING_SESSION_ATTENDANCE_STATUS" AS ENUM('PENDING', 'PRESENT', 'LEAVE');--> statement-breakpoint
CREATE TYPE "public"."TRAINING_SESSION_STATUS" AS ENUM('DRAFT', 'PUBLISHED', 'CLOSED');--> statement-breakpoint
ALTER TYPE "public"."ENTERPRISE_ROLE" ADD VALUE 'MENTOR' BEFORE 'EMPLOYEE';--> statement-breakpoint
ALTER TYPE "public"."ENTERPRISE_ROLE" ADD VALUE 'EXECUTIVE' BEFORE 'EMPLOYEE';--> statement-breakpoint
CREATE TABLE "enterprise_department_scope" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" bigint NOT NULL,
	"department_id" uuid NOT NULL,
	"created_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enterprise_department_scope_unique" UNIQUE("organization_id","member_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "enterprise_person_scope" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" bigint NOT NULL,
	"target_member_id" bigint NOT NULL,
	"created_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enterprise_person_scope_unique" UNIQUE("organization_id","member_id","target_member_id")
);
--> statement-breakpoint
CREATE TABLE "organization_member_department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" bigint NOT NULL,
	"department_id" uuid NOT NULL,
	"source" varchar(24) DEFAULT 'MANUAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_member_department_unique" UNIQUE("organization_id","member_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "training_operation_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_profile_id" uuid,
	"target_member_id" bigint,
	"resource_type" varchar(64) NOT NULL,
	"resource_id" varchar(128) NOT NULL,
	"action" varchar(64) NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"member_id" bigint,
	"answers" jsonb NOT NULL,
	CONSTRAINT "survey_answer_task_member_unique" UNIQUE("task_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "survey_participation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"member_id" bigint NOT NULL,
	"submitted" boolean DEFAULT false NOT NULL,
	"draft" jsonb,
	CONSTRAINT "survey_participation_task_member_unique" UNIQUE("task_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "survey_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"member_id" bigint,
	"department_id" uuid,
	CONSTRAINT "survey_target_one_reference" CHECK (("survey_target"."member_id" is null) <> ("survey_target"."department_id" is null))
);
--> statement-breakpoint
CREATE TABLE "survey_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"course_id" uuid,
	"anonymous" boolean NOT NULL,
	"audience" varchar(16) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_task_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "survey_task_valid_window" CHECK ("survey_task"."ends_at" > "survey_task"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "survey_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"questions" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_template_org_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "mentorship_certification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"supervisor_review_id" uuid,
	"certifier_member_id" bigint NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentorship_certification_task" UNIQUE("task_id")
);
--> statement-breakpoint
CREATE TABLE "mentorship_handover" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"old_relation_id" uuid NOT NULL,
	"new_relation_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"actor_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentorship_relation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"learner_member_id" bigint NOT NULL,
	"mentor_member_id" bigint NOT NULL,
	"plan_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentorship_relation_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "mentorship_relation_dates" CHECK ("mentorship_relation"."ends_at" > "mentorship_relation"."starts_at"),
	CONSTRAINT "mentorship_relation_different_members" CHECK ("mentorship_relation"."mentor_member_id" <> "mentorship_relation"."learner_member_id")
);
--> statement-breakpoint
CREATE TABLE "mentorship_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"mentor_member_id" bigint NOT NULL,
	"decision" varchar(16) NOT NULL,
	"score" integer,
	"content" text NOT NULL,
	"observed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentorship_review_submission_id" UNIQUE("submission_id","id")
);
--> statement-breakpoint
CREATE TABLE "mentorship_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"content" text NOT NULL,
	"confirmed" boolean NOT NULL,
	"submitted_by_member_id" bigint NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentorship_submission_task_id" UNIQUE("task_id","id"),
	CONSTRAINT "mentorship_submission_round" UNIQUE("task_id","round")
);
--> statement-breakpoint
CREATE TABLE "mentorship_supervisor_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reviewer_member_id" bigint NOT NULL,
	"decision" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentorship_supervisor_review_parent_id" UNIQUE("review_id","id")
);
--> statement-breakpoint
CREATE TABLE "mentorship_task" (
	"exam_max_score" double precision,
	"exam_pass_threshold" integer,
	"exam_scoring_fingerprint" varchar(64),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"relation_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"objective" text NOT NULL,
	"scoring_criteria" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"course_id" uuid,
	"exercise_id" uuid,
	"submission_type" varchar(20) DEFAULT 'TEXT' NOT NULL,
	"max_score" integer DEFAULT 100 NOT NULL,
	"pass_score" integer DEFAULT 60 NOT NULL,
	"requires_supervisor_review" boolean DEFAULT false NOT NULL,
	"reviewer_member_id" bigint,
	"certifier" varchar(16) DEFAULT 'MENTOR' NOT NULL,
	"state" varchar(32) DEFAULT 'LEARNER_PENDING' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentorship_task_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "mentorship_task_score_range" CHECK ("mentorship_task"."max_score" > 0 AND "mentorship_task"."pass_score" >= 0 AND "mentorship_task"."pass_score" <= "mentorship_task"."max_score"),
	CONSTRAINT "mentorship_task_review_configuration" CHECK ((NOT "mentorship_task"."requires_supervisor_review" OR "mentorship_task"."reviewer_member_id" IS NOT NULL) AND ("mentorship_task"."certifier" <> 'REVIEWER' OR "mentorship_task"."requires_supervisor_review"))
);
--> statement-breakpoint
CREATE TABLE "training_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"course_id" uuid,
	"plan_id" uuid,
	"instructor" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"checkin_opens_at" timestamp with time zone NOT NULL,
	"checkin_closes_at" timestamp with time zone NOT NULL,
	"status" "TRAINING_SESSION_STATUS" DEFAULT 'DRAFT' NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_session_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "training_session_dates_valid" CHECK ("training_session"."end_at" > "training_session"."start_at" AND "training_session"."checkin_closes_at" > "training_session"."checkin_opens_at" AND "training_session"."checkin_closes_at" <= "training_session"."end_at")
);
--> statement-breakpoint
CREATE TABLE "training_session_attendee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"member_id" bigint NOT NULL,
	"status" "TRAINING_SESSION_ATTENDANCE_STATUS" DEFAULT 'PENDING' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"method" varchar(20),
	"reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_session_member_unique" UNIQUE("session_id","member_id"),
	CONSTRAINT "training_session_present_timestamp" CHECK (("training_session_attendee"."status" = 'PRESENT' AND "training_session_attendee"."checked_in_at" IS NOT NULL) OR ("training_session_attendee"."status" != 'PRESENT' AND "training_session_attendee"."checked_in_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "training_session_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"digest" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_session_token_digest_unique" UNIQUE("digest")
);
--> statement-breakpoint
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_org_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "enterprise_department_scope" ADD CONSTRAINT "enterprise_department_scope_created_by_profile_id_profile_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_department_scope" ADD CONSTRAINT "enterprise_department_scope_member_fkey" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_department_scope" ADD CONSTRAINT "enterprise_department_scope_department_fkey" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."department"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_person_scope" ADD CONSTRAINT "enterprise_person_scope_created_by_profile_id_profile_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_person_scope" ADD CONSTRAINT "enterprise_person_scope_member_fkey" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_person_scope" ADD CONSTRAINT "enterprise_person_scope_target_fkey" FOREIGN KEY ("organization_id","target_member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_department" ADD CONSTRAINT "organization_member_department_member_fkey" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_department" ADD CONSTRAINT "organization_member_department_department_fkey" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."department"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_operation_audit" ADD CONSTRAINT "training_operation_audit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_operation_audit" ADD CONSTRAINT "training_operation_audit_actor_profile_id_profile_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answer" ADD CONSTRAINT "survey_answer_organization_id_task_id_survey_task_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."survey_task"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answer" ADD CONSTRAINT "survey_answer_organization_id_member_id_organizationmember_organization_id_id_fk" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_participation" ADD CONSTRAINT "survey_participation_organization_id_task_id_survey_task_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."survey_task"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_participation" ADD CONSTRAINT "survey_participation_organization_id_member_id_organizationmember_organization_id_id_fk" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_target" ADD CONSTRAINT "survey_target_organization_id_task_id_survey_task_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."survey_task"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_target" ADD CONSTRAINT "survey_target_organization_id_member_id_organizationmember_organization_id_id_fk" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_target" ADD CONSTRAINT "survey_target_organization_id_department_id_department_organization_id_id_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."department"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_task" ADD CONSTRAINT "survey_task_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_task" ADD CONSTRAINT "survey_task_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_task" ADD CONSTRAINT "survey_task_organization_id_template_id_survey_template_organization_id_id_fk" FOREIGN KEY ("organization_id","template_id") REFERENCES "public"."survey_template"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_template" ADD CONSTRAINT "survey_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_certification" ADD CONSTRAINT "mentorship_certification_task_id_mentorship_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."mentorship_task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_certification" ADD CONSTRAINT "mentorship_certification_submission_id_mentorship_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."mentorship_submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_certification" ADD CONSTRAINT "mentorship_certification_review_id_mentorship_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."mentorship_review"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_certification" ADD CONSTRAINT "mentorship_certification_supervisor_review_id_mentorship_supervisor_review_id_fk" FOREIGN KEY ("supervisor_review_id") REFERENCES "public"."mentorship_supervisor_review"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_certification" ADD CONSTRAINT "mentorship_certification_certifier_member_id_organizationmember_id_fk" FOREIGN KEY ("certifier_member_id") REFERENCES "public"."organizationmember"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_certification" ADD CONSTRAINT "mentorship_certification_task_id_submission_id_mentorship_submission_task_id_id_fk" FOREIGN KEY ("task_id","submission_id") REFERENCES "public"."mentorship_submission"("task_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_certification" ADD CONSTRAINT "mentorship_certification_submission_id_review_id_mentorship_review_submission_id_id_fk" FOREIGN KEY ("submission_id","review_id") REFERENCES "public"."mentorship_review"("submission_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_certification" ADD CONSTRAINT "mentorship_certification_review_id_supervisor_review_id_mentorship_supervisor_review_review_id_id_fk" FOREIGN KEY ("review_id","supervisor_review_id") REFERENCES "public"."mentorship_supervisor_review"("review_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_handover" ADD CONSTRAINT "mentorship_handover_old_relation_id_mentorship_relation_id_fk" FOREIGN KEY ("old_relation_id") REFERENCES "public"."mentorship_relation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_handover" ADD CONSTRAINT "mentorship_handover_new_relation_id_mentorship_relation_id_fk" FOREIGN KEY ("new_relation_id") REFERENCES "public"."mentorship_relation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_handover" ADD CONSTRAINT "mentorship_handover_actor_profile_id_profile_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_handover" ADD CONSTRAINT "mentorship_handover_organization_id_old_relation_id_mentorship_relation_organization_id_id_fk" FOREIGN KEY ("organization_id","old_relation_id") REFERENCES "public"."mentorship_relation"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_handover" ADD CONSTRAINT "mentorship_handover_organization_id_new_relation_id_mentorship_relation_organization_id_id_fk" FOREIGN KEY ("organization_id","new_relation_id") REFERENCES "public"."mentorship_relation"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_relation" ADD CONSTRAINT "mentorship_relation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_relation" ADD CONSTRAINT "mentorship_relation_created_by_profile_id_profile_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_relation" ADD CONSTRAINT "mentorship_relation_organization_id_learner_member_id_organizationmember_organization_id_id_fk" FOREIGN KEY ("organization_id","learner_member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_relation" ADD CONSTRAINT "mentorship_relation_organization_id_mentor_member_id_organizationmember_organization_id_id_fk" FOREIGN KEY ("organization_id","mentor_member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_relation" ADD CONSTRAINT "mentorship_relation_organization_id_plan_id_training_plan_organization_id_id_fk" FOREIGN KEY ("organization_id","plan_id") REFERENCES "public"."training_plan"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_review" ADD CONSTRAINT "mentorship_review_submission_id_mentorship_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."mentorship_submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_review" ADD CONSTRAINT "mentorship_review_mentor_member_id_organizationmember_id_fk" FOREIGN KEY ("mentor_member_id") REFERENCES "public"."organizationmember"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_submission" ADD CONSTRAINT "mentorship_submission_submitted_by_member_id_organizationmember_id_fk" FOREIGN KEY ("submitted_by_member_id") REFERENCES "public"."organizationmember"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_submission" ADD CONSTRAINT "mentorship_submission_organization_id_task_id_mentorship_task_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."mentorship_task"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_submission" ADD CONSTRAINT "mentorship_submission_organization_id_submitted_by_member_id_organizationmember_organization_id_id_fk" FOREIGN KEY ("organization_id","submitted_by_member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_supervisor_review" ADD CONSTRAINT "mentorship_supervisor_review_review_id_mentorship_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."mentorship_review"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_supervisor_review" ADD CONSTRAINT "mentorship_supervisor_review_reviewer_member_id_organizationmember_id_fk" FOREIGN KEY ("reviewer_member_id") REFERENCES "public"."organizationmember"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_task" ADD CONSTRAINT "mentorship_task_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_task" ADD CONSTRAINT "mentorship_task_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_task" ADD CONSTRAINT "mentorship_task_created_by_profile_id_profile_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_task" ADD CONSTRAINT "mentorship_task_organization_id_relation_id_mentorship_relation_organization_id_id_fk" FOREIGN KEY ("organization_id","relation_id") REFERENCES "public"."mentorship_relation"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_task" ADD CONSTRAINT "mentorship_task_organization_id_reviewer_member_id_organizationmember_organization_id_id_fk" FOREIGN KEY ("organization_id","reviewer_member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_created_by_profile_id_profile_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_organization_id_plan_id_training_plan_organization_id_id_fk" FOREIGN KEY ("organization_id","plan_id") REFERENCES "public"."training_plan"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_attendee" ADD CONSTRAINT "training_session_attendee_organization_id_session_id_training_session_organization_id_id_fk" FOREIGN KEY ("organization_id","session_id") REFERENCES "public"."training_session"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_attendee" ADD CONSTRAINT "training_session_attendee_organization_id_member_id_organizationmember_organization_id_id_fk" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_token" ADD CONSTRAINT "training_session_token_organization_id_session_id_training_session_organization_id_id_fk" FOREIGN KEY ("organization_id","session_id") REFERENCES "public"."training_session"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_member_department_scope" ON "organization_member_department" USING btree ("organization_id","department_id");--> statement-breakpoint
CREATE INDEX "training_operation_audit_org_time" ON "training_operation_audit" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_relation_current_learner_plan" ON "mentorship_relation" USING btree ("organization_id","learner_member_id",coalesce("plan_id"::text, '')) WHERE "mentorship_relation"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "mentorship_relation_mentor" ON "mentorship_relation" USING btree ("organization_id","mentor_member_id");--> statement-breakpoint
CREATE INDEX "mentorship_task_queue" ON "mentorship_task" USING btree ("organization_id","state","due_at");--> statement-breakpoint
CREATE INDEX "training_session_org_status_idx" ON "training_session" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "training_session_attendee_member_idx" ON "training_session_attendee" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE INDEX "training_session_token_session_idx" ON "training_session_token" USING btree ("organization_id","session_id");--> statement-breakpoint
INSERT INTO "organization_member_department" ("organization_id", "member_id", "department_id", "source")
SELECT "organization_id", "id", "department_id",
  CASE WHEN "external_source" LIKE 'dingtalk:%' THEN 'DINGTALK' ELSE 'MANUAL' END
FROM "organizationmember"
WHERE "department_id" IS NOT NULL
ON CONFLICT ("organization_id", "member_id", "department_id") DO NOTHING;
