import { t } from '$lib/utils/functions/translations';
import { enterpriseApi } from './enterprise.svelte';
import type {
  AssessmentDraft,
  TrainingMakeupDraft,
  TrainingMakeupResult,
  AssessmentExercises,
  AssessmentScheme,
  EnrollmentAssessment,
  EnterpriseGradingQueue,
  TrainingArchive,
  TrainingArchiveSummary,
  TrainingEvaluationDraft,
  TrainingMatrix,
  TrainingStatistics
} from '../utils/types';

export class AssessmentApi {
  private organizationId = '';
  private managerPlanId = '';
  private managerRequest = 0;
  private detailEnrollmentId = '';
  scheme = $state<AssessmentScheme>(null);
  exercises = $state<AssessmentExercises>([]);
  archive = $state<TrainingArchive>([]);
  private archiveRequest = 0;
  archiveSummary = $state<TrainingArchiveSummary | null>(null);
  matrix = $state<TrainingMatrix | null>(null);
  statistics = $state<TrainingStatistics | null>(null);
  gradingQueue = $state<EnterpriseGradingQueue>([]);
  gradingQueueError = $state('');
  gradingQueueLoading = $state(false);
  detail = $state<EnrollmentAssessment | null>(null);
  loading = $state(false);
  busy = $state(false);
  error = $state('');

  private useOrganization(organizationId: string) {
    if (this.organizationId === organizationId) return;

    this.organizationId = organizationId;
    this.managerPlanId = '';
    this.detailEnrollmentId = '';
    this.scheme = null;
    this.exercises = [];
    this.archive = [];
    this.archiveSummary = null;
    this.matrix = null;
    this.statistics = null;
    this.gradingQueue = [];
    this.gradingQueueError = '';
    this.detail = null;
  }

  async loadManager(organizationId: string, planId: string, from?: string, to?: string) {
    const request = ++this.managerRequest;
    this.useOrganization(organizationId);
    if (this.managerPlanId !== planId) {
      this.scheme = null;
      this.exercises = [];
      this.archive = [];
      this.statistics = null;
      this.detail = null;
    }

    this.managerPlanId = planId;
    this.loading = true;
    this.error = '';
    try {
      const [scheme, exercises, archive, statistics] = await Promise.all([
        enterpriseApi.request<AssessmentScheme>(organizationId, `/plans/${planId}/assessment`),
        enterpriseApi.request<AssessmentExercises>(organizationId, `/plans/${planId}/exercises`),
        enterpriseApi.request<TrainingArchive>(organizationId, `/archive?planId=${planId}`),
        enterpriseApi.request<TrainingStatistics>(
          organizationId,
          `/plans/${planId}/statistics?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}`
        )
      ]);
      if (request !== this.managerRequest || this.organizationId !== organizationId || this.managerPlanId !== planId)
        return;

      this.scheme = scheme;
      this.exercises = exercises;
      this.archive = archive;
      this.statistics = statistics;
      return true;
    } catch {
      if (request === this.managerRequest && this.organizationId === organizationId && this.managerPlanId === planId)
        this.error = t.get('enterprise.load_failed');
    } finally {
      if (request === this.managerRequest && this.organizationId === organizationId && this.managerPlanId === planId)
        this.loading = false;
    }
  }

  async grantMakeup(organizationId: string, planId: string, values: TrainingMakeupDraft) {
    this.busy = true;
    this.error = '';
    try {
      return await enterpriseApi.request<TrainingMakeupResult>(
        organizationId,
        `/plans/${planId}/makeup`,
        'POST',
        values
      );
    } catch (error) {
      this.error = error instanceof Error ? error.message : t.get('enterprise.request_failed');
      return null;
    } finally {
      this.busy = false;
    }
  }

  async loadArchive(organizationId: string) {
    this.useOrganization(organizationId);
    this.loading = true;
    this.error = '';
    try {
      const archive = await enterpriseApi.request<TrainingArchive>(organizationId, '/archive');
      if (this.organizationId === organizationId) this.archive = archive;
    } catch {
      this.error = t.get('enterprise.load_failed');
    } finally {
      this.loading = false;
    }
  }

  async loadArchiveSummary(organizationId: string, memberId?: number) {
    const request = ++this.archiveRequest;
    this.useOrganization(organizationId);
    this.archiveSummary = null;
    this.loading = true;
    this.error = '';
    try {
      const query = memberId ? `?memberId=${memberId}` : '';
      const summary = await enterpriseApi.request<TrainingArchiveSummary>(organizationId, `/archive/summary${query}`);
      if (request === this.archiveRequest && this.organizationId === organizationId) this.archiveSummary = summary;
    } catch {
      if (request === this.archiveRequest) this.error = t.get('enterprise.load_failed');
    } finally {
      if (request === this.archiveRequest) this.loading = false;
    }
  }

  async loadMatrix(organizationId: string) {
    this.useOrganization(organizationId);
    this.loading = true;
    this.error = '';
    try {
      const matrix = await enterpriseApi.request<TrainingMatrix>(organizationId, '/matrix');
      if (this.organizationId === organizationId) this.matrix = matrix;
    } catch {
      this.error = t.get('enterprise.load_failed');
    } finally {
      this.loading = false;
    }
  }

  async loadStatistics(organizationId: string, from?: string, to?: string) {
    this.useOrganization(organizationId);
    this.loading = true;
    this.error = '';
    try {
      const query = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
      const statistics = await enterpriseApi.request<TrainingStatistics>(organizationId, `/statistics?${query}`);
      if (this.organizationId === organizationId) this.statistics = statistics;
    } catch {
      this.error = t.get('enterprise.load_failed');
    } finally {
      this.loading = false;
    }
  }

  async loadGradingQueue(organizationId: string) {
    this.useOrganization(organizationId);
    this.gradingQueueLoading = true;
    this.gradingQueueError = '';
    try {
      const queue = await enterpriseApi.request<EnterpriseGradingQueue>(organizationId, '/grading-queue');
      if (this.organizationId === organizationId) this.gradingQueue = queue;
    } catch {
      if (this.organizationId === organizationId) this.gradingQueueError = t.get('enterprise.load_failed');
    } finally {
      if (this.organizationId === organizationId) this.gradingQueueLoading = false;
    }
  }

  async loadDetail(organizationId: string, enrollmentId: string) {
    this.useOrganization(organizationId);
    if (this.detailEnrollmentId !== enrollmentId) this.detail = null;

    this.detailEnrollmentId = enrollmentId;
    this.loading = true;
    this.error = '';
    try {
      const detail = await enterpriseApi.request<EnrollmentAssessment>(
        organizationId,
        `/enrollments/${enrollmentId}/assessment`
      );
      if (this.organizationId === organizationId && this.detailEnrollmentId === enrollmentId) this.detail = detail;
    } catch {
      if (this.organizationId === organizationId && this.detailEnrollmentId === enrollmentId)
        this.error = t.get('enterprise.load_failed');
    } finally {
      if (this.organizationId === organizationId && this.detailEnrollmentId === enrollmentId) this.loading = false;
    }
  }

  async saveScheme(organizationId: string, planId: string, draft: AssessmentDraft) {
    return this.perform(async () => {
      this.scheme = await enterpriseApi.request<AssessmentScheme>(
        organizationId,
        `/plans/${planId}/assessment`,
        'PUT',
        draft
      );
    });
  }

  async publishScheme(organizationId: string, planId: string) {
    return this.perform(async () => {
      this.scheme = await enterpriseApi.request<AssessmentScheme>(
        organizationId,
        `/plans/${planId}/assessment/publish`,
        'POST'
      );
    });
  }

  async recalculate(organizationId: string, enrollmentId: string) {
    return this.perform(async () => {
      await enterpriseApi.request(organizationId, `/enrollments/${enrollmentId}/assessment/recalculate`, 'POST');
      await this.loadDetail(organizationId, enrollmentId);
    });
  }

  async enterScore(organizationId: string, enrollmentId: string, itemId: string, score: number) {
    return this.perform(async () => {
      await enterpriseApi.request(organizationId, `/enrollments/${enrollmentId}/items/${itemId}/input`, 'POST', {
        score
      });
      await this.loadDetail(organizationId, enrollmentId);
    });
  }

  async adjust(organizationId: string, enrollmentId: string, amount: number, reason: string) {
    return this.perform(async () => {
      this.detail = await enterpriseApi.request<EnrollmentAssessment>(
        organizationId,
        `/enrollments/${enrollmentId}/assessment/adjust`,
        'POST',
        { amount, reason }
      );
    });
  }

  async evaluate(organizationId: string, enrollmentId: string, draft: TrainingEvaluationDraft) {
    return this.perform(async () => {
      await enterpriseApi.request(organizationId, `/enrollments/${enrollmentId}/evaluation`, 'POST', draft);
      await this.loadDetail(organizationId, enrollmentId);
    });
  }

  private async perform(action: () => Promise<void>) {
    this.busy = true;
    this.error = '';
    try {
      await action();
      return true;
    } catch {
      this.error = t.get('enterprise.request_failed');
      return false;
    } finally {
      this.busy = false;
    }
  }
}
