import { classroomio } from '$lib/utils/services/api';
import { BaseApiWithErrors } from '$lib/utils/services/api/base.svelte';
import { t } from '$lib/utils/functions/translations';
import {
  ZMentorshipBulk,
  ZMentorshipCertification,
  ZMentorshipChangeMentor,
  ZMentorshipReview,
  ZMentorshipSubmission,
  ZMentorshipSupervisorReview,
  ZMentorshipTask
} from '@cio/utils/validation/mentorship';
import type {
  MentorshipAssignRequest,
  MentorshipBindRequest,
  MentorshipBindingDraft,
  MentorshipCertifyRequest,
  MentorshipChangeRequest,
  MentorshipDetail,
  MentorshipDetailRequest,
  MentorshipList,
  MentorshipListRequest,
  MentorshipOptions,
  MentorshipOptionsRequest,
  MentorshipRelations,
  MentorshipRelationsRequest,
  MentorshipReviewRequest,
  MentorshipState,
  MentorshipSubmitRequest,
  MentorshipSupervisorRequest,
  MentorshipTaskDraft
} from '../utils/types';
import { createMentorshipBindingDraft, isoDateTime } from '../utils/mentorship-utils';

export class MentorshipApi extends BaseApiWithErrors {
  organizationId = $state('');
  tasks = $state<MentorshipList>([]);
  relations = $state<MentorshipRelations>([]);
  options = $state<MentorshipOptions | null>(null);
  detail = $state<MentorshipDetail | null>(null);
  loading = $state(false);
  detailLoading = $state(false);
  busy = $state(false);
  notice = $state('');
  filterState = $state<MentorshipState | ''>('');
  dueBefore = $state('');
  binding = $state<MentorshipBindingDraft>(createMentorshipBindingDraft());
  taskDraft = $state<MentorshipTaskDraft>({
    title: '',
    objective: '',
    scoringCriteria: '',
    dueAt: '',
    courseId: '',
    exerciseId: '',
    submissionType: 'TEXT',
    maxScore: 100,
    passScore: 60,
    requiresSupervisorReview: false,
    reviewerMemberId: '',
    certifier: 'MENTOR',
    relationIds: []
  });
  replacementMentorId = $state('');
  replacementReason = $state('');
  selectedRelationId = $state('');
  submissionText = $state('');
  completionConfirmed = $state(false);
  reviewContent = $state('');
  reviewScore = $state(0);
  observedAt = $state('');
  certificationContent = $state('');
  private generation = 0;
  private detailGeneration = 0;
  private contextGeneration = 0;

  private headers() {
    return { headers: { 'cio-org-id': this.organizationId } };
  }

  async openContext(organizationId: string, taskId: string) {
    this.contextGeneration += 1;
    const contextGeneration = this.contextGeneration;
    await this.switchOrganization(organizationId);
    if (contextGeneration !== this.contextGeneration || !taskId) return;

    await this.selectTask(taskId);
  }

  clearActions() {
    this.submissionText = '';
    this.completionConfirmed = false;
    this.reviewContent = '';
    this.reviewScore = 0;
    this.observedAt = '';
    this.certificationContent = '';
  }

  async switchOrganization(organizationId: string) {
    if (organizationId === this.organizationId) return;

    this.organizationId = organizationId;
    this.generation += 1;
    this.detailGeneration += 1;
    this.tasks = [];
    this.relations = [];
    this.options = null;
    this.detail = null;
    this.notice = '';
    this.filterState = '';
    this.dueBefore = '';
    this.binding.learnerMemberIds = [];
    this.binding.mentorMemberId = '';
    this.binding.planId = '';
    this.taskDraft.relationIds = [];
    this.taskDraft.reviewerMemberId = '';
    this.taskDraft.courseId = '';
    this.taskDraft.exerciseId = '';
    this.taskDraft.title = '';
    this.taskDraft.objective = '';
    this.taskDraft.scoringCriteria = '';
    this.taskDraft.dueAt = '';
    this.taskDraft.requiresSupervisorReview = false;
    this.taskDraft.certifier = 'MENTOR';
    this.taskDraft.submissionType = 'TEXT';
    this.taskDraft.maxScore = 100;
    this.taskDraft.passScore = 60;
    this.binding.search = '';
    this.selectedRelationId = '';
    this.replacementMentorId = '';
    this.replacementReason = '';
    this.clearActions();
    this.reset();
    if (organizationId) await this.load();
  }

  async load() {
    const generation = this.generation;
    this.loading = true;
    this.tasks = [];
    const options = await this.execute<MentorshipOptionsRequest>({
      requestFn: () => classroomio.enterprise.mentorships.options.$get({}, this.headers())
    });
    if (generation !== this.generation) return;
    if (!options) {
      this.loading = false;
      return;
    }

    this.options = options.data;

    const relations = await this.execute<MentorshipRelationsRequest>({
      requestFn: () => classroomio.enterprise.mentorships.relations.$get({}, this.headers())
    });
    if (generation !== this.generation) return;
    if (!relations) {
      this.loading = false;
      return;
    }

    this.relations = relations.data;

    const dueBefore = this.dueBefore ? isoDateTime(this.dueBefore) : undefined;
    const state = this.filterState || undefined;
    const tasks = await this.execute<MentorshipListRequest>({
      requestFn: () => classroomio.enterprise.mentorships.$get({ query: { state, dueBefore } }, this.headers())
    });
    if (generation !== this.generation) return;
    if (tasks) this.tasks = tasks.data;

    this.loading = false;
  }

  async selectTask(taskId: string) {
    this.detailGeneration += 1;
    const detailGeneration = this.detailGeneration;
    const generation = this.generation;
    this.detail = null;
    this.detailLoading = true;
    this.clearActions();
    const result = await this.execute<MentorshipDetailRequest>({
      requestFn: () => classroomio.enterprise.mentorships.tasks[':id'].$get({ param: { id: taskId } }, this.headers())
    });
    if (generation !== this.generation || detailGeneration !== this.detailGeneration) return;
    if (result) this.detail = result.data;
    this.detailLoading = false;
  }

  toggleLearner(memberId: number) {
    this.binding.learnerMemberIds = this.binding.learnerMemberIds.includes(memberId)
      ? this.binding.learnerMemberIds.filter((selected) => selected !== memberId)
      : [...this.binding.learnerMemberIds, memberId];
  }

  toggleRelation(relationId: string) {
    this.taskDraft.relationIds = this.taskDraft.relationIds.includes(relationId)
      ? this.taskDraft.relationIds.filter((selected) => selected !== relationId)
      : [...this.taskDraft.relationIds, relationId];
  }

  private invalid() {
    this.errors.general = t.get('mentorship.invalid');
    return false;
  }

  private async write(operation: () => Promise<unknown>) {
    if (this.busy || this.loading) return;

    const generation = this.generation;
    const taskId = this.detail?.task.id;
    this.busy = true;
    this.notice = '';
    this.resetErrors();
    try {
      const result = await operation();
      if (!result || generation !== this.generation) return;

      this.notice = t.get('mentorship.saved');
      await this.load();
      if (taskId && generation === this.generation) await this.selectTask(taskId);
    } finally {
      this.busy = false;
    }
  }

  async bind() {
    const parsed = ZMentorshipBulk.safeParse({
      learnerMemberIds: this.binding.learnerMemberIds,
      mentorMemberId: Number(this.binding.mentorMemberId),
      planId: this.binding.planId || null,
      startsAt: isoDateTime(this.binding.startsAt),
      endsAt: isoDateTime(this.binding.endsAt)
    });
    if (!parsed.success) return this.invalid();

    await this.write(() =>
      this.execute<MentorshipBindRequest>({
        requestFn: () => classroomio.enterprise.mentorships.relations.bulk.$post({ json: parsed.data }, this.headers())
      })
    );
  }

  async assign() {
    const draft = this.taskDraft;
    const parsed = ZMentorshipTask.safeParse({
      ...draft,
      dueAt: isoDateTime(draft.dueAt),
      courseId: draft.courseId || null,
      exerciseId: draft.exerciseId || null,
      reviewerMemberId: draft.requiresSupervisorReview ? Number(draft.reviewerMemberId) : null,
      certifier: draft.requiresSupervisorReview ? draft.certifier : 'MENTOR'
    });
    if (!parsed.success) return this.invalid();

    await this.write(() =>
      this.execute<MentorshipAssignRequest>({
        requestFn: () => classroomio.enterprise.mentorships.tasks.$post({ json: parsed.data }, this.headers()),
        onError: (error) => {
          if (typeof error === 'object' && error !== null && 'field' in error && error.field === 'examPassThreshold') {
            this.errors.general = t.get('mentorship.exam_threshold_required');
          }
        }
      })
    );
  }

  async changeMentor() {
    const parsed = ZMentorshipChangeMentor.safeParse({
      mentorMemberId: Number(this.replacementMentorId),
      reason: this.replacementReason
    });
    if (!parsed.success || !this.selectedRelationId) return this.invalid();

    await this.write(() =>
      this.execute<MentorshipChangeRequest>({
        requestFn: () =>
          classroomio.enterprise.mentorships.relations[':id']['change-mentor'].$post(
            { param: { id: this.selectedRelationId }, json: parsed.data },
            this.headers()
          )
      })
    );
  }

  async submit() {
    const detail = this.detail;
    if (!detail) return;

    const parsed = ZMentorshipSubmission.safeParse({
      expectedRevision: detail.task.revision,
      content: this.submissionText,
      confirmed: this.completionConfirmed
    });
    if (!parsed.success || (detail.task.submissionType === 'TEXT' && !this.submissionText.trim()))
      return this.invalid();

    await this.write(() =>
      this.execute<MentorshipSubmitRequest>({
        requestFn: () =>
          classroomio.enterprise.mentorships.tasks[':id'].submissions.$post(
            { param: { id: detail.task.id }, json: parsed.data },
            this.headers()
          )
      })
    );
  }

  async review(decision: 'PASS' | 'RETURN') {
    const detail = this.detail;
    if (!detail) return;

    const submissionId = detail.history.submissions[0]?.id;
    const parsed = ZMentorshipReview.safeParse({
      expectedRevision: detail.task.revision,
      submissionId,
      decision,
      score: this.reviewScore,
      content: this.reviewContent,
      observedAt: this.observedAt ? isoDateTime(this.observedAt) : null
    });
    if (!parsed.success) return this.invalid();

    await this.write(() =>
      this.execute<MentorshipReviewRequest>({
        requestFn: () =>
          classroomio.enterprise.mentorships.tasks[':id'].reviews.$post(
            { param: { id: detail.task.id }, json: parsed.data },
            this.headers()
          )
      })
    );
  }

  async supervisorReview(decision: 'PASS' | 'RETURN') {
    const detail = this.detail;
    if (!detail) return;

    const submissionId = detail.history.submissions[0]?.id;
    const review = detail.history.reviews.find((review) => review.submissionId === submissionId);
    const parsed = ZMentorshipSupervisorReview.safeParse({
      expectedRevision: detail.task.revision,
      submissionId,
      reviewId: review?.id,
      decision,
      content: this.reviewContent
    });
    if (!parsed.success) return this.invalid();

    await this.write(() =>
      this.execute<MentorshipSupervisorRequest>({
        requestFn: () =>
          classroomio.enterprise.mentorships.tasks[':id']['supervisor-reviews'].$post(
            { param: { id: detail.task.id }, json: parsed.data },
            this.headers()
          )
      })
    );
  }

  async certify() {
    const detail = this.detail;
    if (!detail) return;

    const submissionId = detail.history.submissions[0]?.id;
    const review = detail.history.reviews.find((review) => review.submissionId === submissionId);
    const parsed = ZMentorshipCertification.safeParse({
      expectedRevision: detail.task.revision,
      submissionId,
      reviewId: review?.id,
      content: this.certificationContent
    });
    if (!parsed.success) return this.invalid();

    await this.write(() =>
      this.execute<MentorshipCertifyRequest>({
        requestFn: () =>
          classroomio.enterprise.mentorships.tasks[':id'].certifications.$post(
            { param: { id: detail.task.id }, json: parsed.data },
            this.headers()
          )
      })
    );
  }

  async exportCsv() {
    if (this.busy) return;

    this.busy = true;
    try {
      const dueBefore = this.dueBefore ? isoDateTime(this.dueBefore) : undefined;
      const state = this.filterState || undefined;
      const response = await classroomio.enterprise.mentorships.export.$get(
        { query: { state, dueBefore } },
        this.headers()
      );
      if (!response.ok) {
        this.errors.general = t.get('mentorship.failed');
        return;
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = 'mentorships.csv';
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      this.errors.general = t.get('mentorship.failed');
    } finally {
      this.busy = false;
    }
  }
}
