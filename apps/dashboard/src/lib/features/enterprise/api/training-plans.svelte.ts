import { t } from '$lib/utils/functions/translations';
import { enterpriseApi } from './enterprise.svelte';
import { ZTrainingPlanDraft } from '@cio/utils/validation/training-plan';
import { enterpriseValidationMessage } from '../utils/enterprise-errors';
import type {
  AssessmentScheme,
  AvailableTrainingCourses,
  TrainingPlanDetail,
  TrainingReminderResult,
  TrainingPlanExtension,
  TrainingPlanDraft,
  TrainingPlanPreview,
  TrainingPlanSupplement,
  TrainingPlans
} from '../utils/types';

class TrainingPlansApi {
  private organizationId: string | null = null;
  private selectionRequest = 0;
  private assessmentRequest = 0;
  plans = $state<TrainingPlans>([]);
  courses = $state<AvailableTrainingCourses>([]);
  selected = $state<TrainingPlanDetail | null>(null);
  preview = $state<TrainingPlanPreview | null>(null);
  assessment = $state<AssessmentScheme>(null);
  assessmentLoading = $state(false);
  assessmentError = $state('');
  loading = $state(false);
  busy = $state(false);
  error = $state('');

  clearSelection() {
    this.selectionRequest += 1;
    this.selected = null;
    this.preview = null;
    this.assessmentRequest += 1;
    this.assessment = null;
    this.assessmentLoading = false;
    this.assessmentError = '';
  }

  async load(organizationId: string) {
    if (this.organizationId !== organizationId) {
      this.organizationId = organizationId;
      this.plans = [];
      this.courses = [];
      this.clearSelection();
    }

    this.loading = true;
    this.error = '';
    try {
      const [plans, courses] = await Promise.all([
        enterpriseApi.request<TrainingPlans>(organizationId, '/plans'),
        enterpriseApi.request<AvailableTrainingCourses>(organizationId, '/training-courses')
      ]);
      this.plans = plans;
      this.courses = courses;
    } catch (error) {
      this.error = error instanceof Error ? error.message : t.get('enterprise.load_failed');
    } finally {
      this.loading = false;
    }
  }

  async select(organizationId: string, planId: string) {
    this.clearSelection();
    const request = this.selectionRequest;
    this.error = '';
    try {
      const detail = await enterpriseApi.request<TrainingPlanDetail>(organizationId, `/plans/${planId}`);
      if (request !== this.selectionRequest || this.organizationId !== organizationId) return null;

      this.selected = detail;
      void this.loadAssessment(organizationId, planId);
      return detail;
    } catch (error) {
      if (request === this.selectionRequest)
        this.error = error instanceof Error ? error.message : t.get('enterprise.load_failed');

      return null;
    }
  }

  async loadAssessment(organizationId: string, planId: string) {
    if (this.organizationId !== organizationId || this.selected?.plan.id !== planId) return;

    const request = ++this.assessmentRequest;
    this.assessment = null;
    this.assessmentLoading = true;
    this.assessmentError = '';
    const isCurrent = () =>
      request === this.assessmentRequest && this.organizationId === organizationId && this.selected?.plan.id === planId;
    try {
      const assessment = await enterpriseApi.request<AssessmentScheme>(organizationId, `/plans/${planId}/assessment`);
      if (isCurrent()) this.assessment = assessment;
    } catch (error) {
      if (isCurrent()) this.assessmentError = error instanceof Error ? error.message : t.get('enterprise.load_failed');
    } finally {
      if (isCurrent()) this.assessmentLoading = false;
    }
  }

  async save(organizationId: string, draft: TrainingPlanDraft, planId?: string) {
    const validated = ZTrainingPlanDraft.safeParse(draft);
    if (!validated.success) {
      this.error = enterpriseValidationMessage(validated.error);
      return null;
    }

    this.busy = true;
    this.error = '';
    try {
      const path = planId ? `/plans/${planId}` : '/plans';
      const method = planId ? 'PUT' : 'POST';
      this.selected = await enterpriseApi.request<TrainingPlanDetail>(organizationId, path, method, validated.data);
      this.preview = null;
      await this.load(organizationId);
      if (this.selected) void this.loadAssessment(organizationId, this.selected.plan.id);
      return this.selected;
    } catch (error) {
      this.error = error instanceof Error ? error.message : t.get('enterprise.request_failed');
      return null;
    } finally {
      this.busy = false;
    }
  }

  async loadPreview(organizationId: string, planId: string) {
    const selectionRequest = this.selectionRequest;
    this.preview = null;
    this.error = '';
    try {
      const preview = await enterpriseApi.request<TrainingPlanPreview>(organizationId, `/plans/${planId}/preview`);
      if (
        this.organizationId === organizationId &&
        this.selected?.plan.id === planId &&
        selectionRequest === this.selectionRequest
      )
        this.preview = preview;
    } catch (error) {
      this.error = error instanceof Error ? error.message : t.get('enterprise.request_failed');
    }
  }

  async publish(organizationId: string, planId: string) {
    this.busy = true;
    this.error = '';
    try {
      this.selected = await enterpriseApi.request<TrainingPlanDetail>(
        organizationId,
        `/plans/${planId}/publish`,
        'POST'
      );
      await this.load(organizationId);
      return true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : t.get('enterprise.request_failed');
      return false;
    } finally {
      this.busy = false;
    }
  }

  async extend(organizationId: string, planId: string, extension: TrainingPlanExtension) {
    const selectionRequest = this.selectionRequest;
    this.busy = true;
    this.error = '';
    try {
      const detail = await enterpriseApi.request<TrainingPlanDetail>(
        organizationId,
        `/plans/${planId}/extend`,
        'POST',
        extension
      );
      if (this.organizationId !== organizationId || selectionRequest !== this.selectionRequest) return false;

      this.selected = detail;
      this.plans = this.plans.map((plan) => (plan.id === planId ? detail.plan : plan));
      return true;
    } catch (error) {
      if (this.organizationId === organizationId)
        this.error = error instanceof Error ? error.message : t.get('enterprise.request_failed');
      return false;
    } finally {
      this.busy = false;
    }
  }

  async remind(organizationId: string, planId: string) {
    this.busy = true;
    this.error = '';
    try {
      const result = await enterpriseApi.request<TrainingReminderResult>(
        organizationId,
        `/plans/${planId}/remind`,
        'POST'
      );
      if (this.organizationId === organizationId && this.selected?.plan.id === planId) {
        await this.select(organizationId, planId);
      }
      return result;
    } catch (error) {
      if (this.organizationId === organizationId)
        this.error = error instanceof Error ? error.message : t.get('enterprise.request_failed');
      return null;
    } finally {
      this.busy = false;
    }
  }

  async supplement(organizationId: string, planId: string, supplement: TrainingPlanSupplement) {
    this.busy = true;
    this.error = '';
    try {
      this.selected = await enterpriseApi.request<TrainingPlanDetail>(
        organizationId,
        `/plans/${planId}/supplement`,
        'POST',
        supplement
      );
      return true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : t.get('enterprise.request_failed');
      return false;
    } finally {
      this.busy = false;
    }
  }
}

export const trainingPlansApi = new TrainingPlansApi();
