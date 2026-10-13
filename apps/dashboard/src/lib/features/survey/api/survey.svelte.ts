import { apiClient, getRequestBaseUrl } from '$lib/utils/services/api';
import { t } from '$lib/utils/functions/translations';
import { ZSurveyTask, ZSurveyTemplate, validateSurveyAnswers } from '@cio/utils/validation/survey';
import type {
  MySurvey,
  MySurveys,
  SurveyAnswerDraft,
  SurveyReport,
  SurveyTaskDetail,
  SurveyTaskDraft,
  SurveyTasks,
  SurveyTemplateDraft,
  SurveyTemplates
} from '../utils/types';

export class SurveyApi {
  private context = '';
  private generation = 0;
  templates = $state<SurveyTemplates | null>(null);
  administration = $state<SurveyTasks | null>(null);
  detail = $state<SurveyTaskDetail | null>(null);
  report = $state<SurveyReport | null>(null);
  mine = $state<MySurveys>([]);
  active = $state<MySurvey | null>(null);
  loading = $state(false);
  busy = $state(false);
  error = $state('');
  notice = $state('');

  clear() {
    this.context = '';
    this.generation++;
    this.templates = null;
    this.administration = null;
    this.detail = null;
    this.report = null;
    this.mine = [];
    this.active = null;
    this.loading = false;
    this.busy = false;
    this.error = '';
    this.notice = '';
  }

  setContext(organizationId: string, profileId: string) {
    const context = `${organizationId}:${profileId}`;
    if (this.context === context) return;

    this.clear();
    this.context = context;
  }

  async request<Result>(organizationId: string, path: string, method = 'GET', body?: unknown): Promise<Result> {
    const response = await apiClient.request(`${getRequestBaseUrl()}/enterprise/surveys${path}`, {
      method,
      credentials: 'include',
      headers: { 'cio-org-id': organizationId, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = (await response.json()) as { success: boolean; data: Result; error?: string };
    if (!response.ok || !result.success) {
      if (response.status === 403) throw new Error(t.get('survey.forbidden'));
      if (response.status === 409) throw new Error(t.get('survey.unavailable'));

      throw new Error(t.get('survey.request_failed'));
    }
    return result.data;
  }

  async load(organizationId: string, profileId: string, management: boolean) {
    this.setContext(organizationId, profileId);
    const generation = ++this.generation;
    this.loading = true;
    this.error = '';
    try {
      if (management) {
        const administration = await this.request<SurveyTasks>(organizationId, '/tasks');
        const templates = administration.canManage
          ? await this.request<SurveyTemplates>(organizationId, '/templates')
          : null;
        if (generation !== this.generation) return;

        this.administration = administration;
        this.templates = templates;
      } else {
        const mine = await this.request<MySurveys>(organizationId, '/mine');
        if (generation === this.generation) this.mine = mine;
      }
    } catch (error) {
      if (generation === this.generation)
        this.error = error instanceof Error ? error.message : t.get('survey.request_failed');
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  async action<Result>(callback: () => Promise<Result>): Promise<Result | null> {
    if (this.busy) return null;

    const generation = this.generation;
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      const result = await callback();
      if (generation !== this.generation) return null;

      return result;
    } catch (error) {
      if (generation === this.generation)
        this.error = error instanceof Error ? error.message : t.get('survey.request_failed');
      return null;
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  async saveTemplate(organizationId: string, draft: SurveyTemplateDraft, id?: string) {
    const parsed = ZSurveyTemplate.safeParse(draft);
    if (!parsed.success) {
      this.error = t.get('survey.invalid_template');
      return null;
    }

    const path = id ? `/templates/${id}` : '/templates';
    const saved = await this.action(() =>
      this.request<SurveyTemplates['templates'][number]>(organizationId, path, id ? 'PUT' : 'POST', parsed.data)
    );
    return saved;
  }

  async publishTemplate(organizationId: string, id: string) {
    return this.action(() => this.request(organizationId, `/templates/${id}/publish`, 'POST'));
  }

  async createTask(organizationId: string, draft: SurveyTaskDraft) {
    const parsed = ZSurveyTask.safeParse(draft);
    if (!parsed.success) {
      this.error = t.get('survey.invalid_task');
      return null;
    }

    return this.action(() => this.request<SurveyTasks['tasks'][number]>(organizationId, '/tasks', 'POST', parsed.data));
  }

  async openTask(organizationId: string, id: string, canManage: boolean) {
    this.detail = null;
    this.report = null;
    const result = await this.action(async () => {
      const detail = canManage ? await this.request<SurveyTaskDetail>(organizationId, `/tasks/${id}`) : null;
      const report = await this.request<SurveyReport>(organizationId, `/tasks/${id}/report`);
      return { detail, report };
    });
    if (result) {
      this.detail = result.detail;
      this.report = result.report;
    }
  }

  async changeTask(organizationId: string, id: string, action: 'publish' | 'close') {
    return this.action(() => this.request<SurveyTaskDetail>(organizationId, `/tasks/${id}/${action}`, 'POST'));
  }

  async openMine(organizationId: string, id: string) {
    this.active = null;
    const result = await this.action(() => this.request<MySurvey>(organizationId, `/mine/${id}`));
    if (result) this.active = result;
    return result;
  }

  async write(organizationId: string, id: string, answers: SurveyAnswerDraft, final: boolean) {
    if (!this.active || !validateSurveyAnswers(this.active.template.questions, answers, final)) {
      this.error = t.get('survey.invalid_answers');
      return null;
    }
    const result = await this.action(() =>
      this.request<{ saved: boolean; submitted: boolean }>(
        organizationId,
        `/mine/${id}/${final ? 'submit' : 'draft'}`,
        final ? 'POST' : 'PUT',
        { answers }
      )
    );
    if (result?.submitted && this.active) {
      this.active.submitted = true;
      this.active.answers = {};
    }
    if (result?.saved) this.notice = t.get('survey.saved');
    return result;
  }

  async download(organizationId: string, id: string, kind: 'answers' | 'participation') {
    await this.action(async () => {
      const response = await apiClient.request(
        `${getRequestBaseUrl()}/enterprise/surveys/tasks/${id}/export?kind=${kind}`,
        { credentials: 'include', headers: { 'cio-org-id': organizationId } }
      );
      if (!response.ok) throw new Error(t.get('survey.request_failed'));

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `survey-${kind}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return true;
    });
  }
}
