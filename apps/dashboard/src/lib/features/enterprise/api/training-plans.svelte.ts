import { t } from '$lib/utils/functions/translations';
import { enterpriseApi } from './enterprise.svelte';
import type {
  AvailableTrainingCourses,
  TrainingPlanDetail,
  TrainingPlanDraft,
  TrainingPlanPreview,
  TrainingPlanSupplement,
  TrainingPlans
} from '../utils/types';

class TrainingPlansApi {
  private organizationId: string | null = null;
  plans = $state<TrainingPlans>([]);
  courses = $state<AvailableTrainingCourses>([]);
  selected = $state<TrainingPlanDetail | null>(null);
  preview = $state<TrainingPlanPreview | null>(null);
  loading = $state(false);
  busy = $state(false);
  error = $state('');

  async load(organizationId: string) {
    if (this.organizationId !== organizationId) {
      this.organizationId = organizationId;
      this.plans = [];
      this.courses = [];
      this.selected = null;
      this.preview = null;
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
    } catch {
      this.error = t.get('enterprise.load_failed');
    } finally {
      this.loading = false;
    }
  }

  async select(organizationId: string, planId: string) {
    this.error = '';
    try {
      this.selected = await enterpriseApi.request<TrainingPlanDetail>(organizationId, `/plans/${planId}`);
      this.preview = null;
    } catch {
      this.error = t.get('enterprise.load_failed');
    }
  }

  async save(organizationId: string, draft: TrainingPlanDraft, planId?: string) {
    this.busy = true;
    this.error = '';
    try {
      const path = planId ? `/plans/${planId}` : '/plans';
      const method = planId ? 'PUT' : 'POST';
      this.selected = await enterpriseApi.request<TrainingPlanDetail>(organizationId, path, method, draft);
      this.preview = null;
      await this.load(organizationId);
      return this.selected;
    } catch {
      this.error = t.get('enterprise.request_failed');
      return null;
    } finally {
      this.busy = false;
    }
  }

  async loadPreview(organizationId: string, planId: string) {
    this.error = '';
    try {
      this.preview = await enterpriseApi.request<TrainingPlanPreview>(organizationId, `/plans/${planId}/preview`);
    } catch {
      this.error = t.get('enterprise.request_failed');
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
    } catch {
      this.error = t.get('enterprise.request_failed');
      return false;
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
    } catch {
      this.error = t.get('enterprise.request_failed');
      return false;
    } finally {
      this.busy = false;
    }
  }
}

export const trainingPlansApi = new TrainingPlansApi();
