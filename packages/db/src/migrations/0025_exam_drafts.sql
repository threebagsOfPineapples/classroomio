ALTER TABLE "exam_attempt" ADD COLUMN "draft_answers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "exam_attempt_expired_pending_idx" ON "exam_attempt" ("expires_at") WHERE "submitted_at" IS NULL;
