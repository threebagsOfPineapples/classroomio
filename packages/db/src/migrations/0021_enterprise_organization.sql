CREATE TYPE "public"."DEPARTMENT_STATUS" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."EMPLOYMENT_STATUS" AS ENUM('ACTIVE', 'ON_LEAVE', 'TERMINATED');--> statement-breakpoint
CREATE TYPE "public"."ENTERPRISE_ROLE" AS ENUM('SUPER_ADMIN', 'TRAINING_ADMIN', 'HR', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'EMPLOYEE');--> statement-breakpoint
CREATE TABLE "department" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "parent_id" uuid,
  "name" varchar(160) NOT NULL,
  "code" varchar(64) NOT NULL,
  "leader_member_id" bigint,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" "DEPARTMENT_STATUS" DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "department_org_id_unique" UNIQUE("organization_id","id"),
  CONSTRAINT "department_org_code_unique" UNIQUE("organization_id","code"),
  CONSTRAINT "department_no_self_parent" CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);--> statement-breakpoint
ALTER TABLE "department" ADD CONSTRAINT "department_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "department" ADD CONSTRAINT "department_parent_fkey" FOREIGN KEY ("organization_id","parent_id") REFERENCES "public"."department"("organization_id","id");--> statement-breakpoint
CREATE INDEX "idx_department_org_parent" ON "department" ("organization_id","parent_id");--> statement-breakpoint
CREATE INDEX "idx_department_org_leader" ON "department" ("organization_id","leader_member_id");--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN "employee_no" varchar(64);--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN "position" varchar(128);--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN "manager_member_id" bigint;--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN "employment_status" "EMPLOYMENT_STATUS";--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN "join_date" date;--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN "external_source" varchar(64);--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN "external_id" varchar(128);--> statement-breakpoint
ALTER TABLE "organizationmember" ADD CONSTRAINT "organizationmember_org_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "organizationmember" ADD CONSTRAINT "organizationmember_department_fkey" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."department"("organization_id","id");--> statement-breakpoint
ALTER TABLE "organizationmember" ADD CONSTRAINT "organizationmember_manager_fkey" FOREIGN KEY ("organization_id","manager_member_id") REFERENCES "public"."organizationmember"("organization_id","id");--> statement-breakpoint
CREATE INDEX "idx_orgmember_department" ON "organizationmember" ("organization_id","department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizationmember_org_employee_no_unique" ON "organizationmember" ("organization_id","employee_no") WHERE "employee_no" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organizationmember_org_external_id_unique" ON "organizationmember" ("organization_id","external_source","external_id") WHERE "external_source" IS NOT NULL AND "external_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE "organization_member_enterprise_role" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "member_id" bigint NOT NULL,
  "role" "ENTERPRISE_ROLE" NOT NULL,
  "created_by_profile_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_member_enterprise_role_unique" UNIQUE("member_id","role")
);--> statement-breakpoint
ALTER TABLE "organization_member_enterprise_role" ADD CONSTRAINT "organization_member_enterprise_role_member_fkey" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organizationmember"("organization_id","id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "organization_member_enterprise_role" ADD CONSTRAINT "organization_member_enterprise_role_created_by_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE set null;--> statement-breakpoint
CREATE INDEX "idx_organization_member_enterprise_role_org" ON "organization_member_enterprise_role" ("organization_id");