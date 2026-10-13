import { apiClient, getRequestBaseUrl } from '$lib/utils/services/api';
import { t } from '$lib/utils/functions/translations';
import { ZTrainingSessionDraft } from '@cio/utils/validation/training-session';
import type {
  TrainingSessionCandidates,
  TrainingSessionCheckin,
  TrainingSessionCorrection,
  TrainingSessionDetail,
  TrainingSessionDraft,
  TrainingSessionFilter,
  TrainingSessionPreview,
  TrainingSessions,
  TrainingSessionToken
} from '../utils/types';

export class TrainingSessionApi {
  sessions = $state<TrainingSessions>([]);
  selected = $state<TrainingSessionDetail | null>(null);
  candidates = $state<TrainingSessionCandidates>([]);
  preview = $state<TrainingSessionPreview | null>(null);
  token = $state<TrainingSessionToken | null>(null);
  loading = $state(false);
  busy = $state(false);
  error = $state('');
  notice = $state('');
  filter = $state<TrainingSessionFilter>({ search: '', status: 'ALL' });
  private requestSequence = 0;

  async request<T>(organizationId: string, path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await apiClient.request(`${getRequestBaseUrl()}/enterprise/sessions${path}`, {
      method,
      credentials: 'include',
      headers: { 'cio-org-id': organizationId, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      const message =
        typeof result.error === 'string' && result.error.startsWith('training_sessions.errors.')
          ? t.get(result.error)
          : t.get(response.status === 403 ? 'training_sessions.errors.forbidden' : 'training_sessions.errors.failed');
      throw new Error(message);
    }
    return result.data as T;
  }

  async load(organizationId: string, mine = false) {
    const sequence = ++this.requestSequence;
    this.loading = true;
    this.error = '';
    this.sessions = [];
    this.selected = null;
    this.token = null;
    try {
      const sessions = await this.request<TrainingSessions>(organizationId, mine ? '/mine' : '');
      if (sequence === this.requestSequence) this.sessions = sessions;
    } catch (error) {
      if (sequence === this.requestSequence)
        this.error = error instanceof Error ? error.message : t.get('training_sessions.errors.failed');
    } finally {
      if (sequence === this.requestSequence) this.loading = false;
    }
  }

  async select(organizationId: string, sessionId: string, mine = false) {
    const sequence = ++this.requestSequence;
    this.loading = true;
    this.error = '';
    this.selected = null;
    this.token = null;
    const query = new URLSearchParams({ search: this.filter.search ?? '', status: this.filter.status ?? 'ALL' });
    try {
      const detail = await this.request<TrainingSessionDetail>(
        organizationId,
        `/${sessionId}${mine ? '/mine' : `?${query}`}`
      );
      if (sequence === this.requestSequence) this.selected = detail;
      return sequence === this.requestSequence ? detail : null;
    } catch (error) {
      if (sequence === this.requestSequence)
        this.error = error instanceof Error ? error.message : t.get('training_sessions.errors.failed');
      return null;
    } finally {
      if (sequence === this.requestSequence) this.loading = false;
    }
  }

  async operation<T>(work: () => Promise<T>) {
    if (this.busy) return null;
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      return await work();
    } catch (error) {
      this.error = error instanceof Error ? error.message : t.get('training_sessions.errors.failed');
      return null;
    } finally {
      this.busy = false;
    }
  }

  async loadCandidates(organizationId: string) {
    const result = await this.operation(() => this.request<TrainingSessionCandidates>(organizationId, '/candidates'));
    if (result) this.candidates = result;
  }

  async previewAudience(organizationId: string, departmentIds: string[], memberIds: number[]) {
    this.preview = null;
    const result = await this.operation(() =>
      this.request<TrainingSessionPreview>(organizationId, '/preview', 'POST', { departmentIds, memberIds })
    );
    if (result) this.preview = result;
    return result;
  }

  async save(organizationId: string, draft: TrainingSessionDraft, sessionId?: string) {
    if (!ZTrainingSessionDraft.safeParse(draft).success) {
      this.error = t.get('training_sessions.errors.invalid_form');
      return null;
    }
    const result = await this.operation(() =>
      this.request<TrainingSessions[number]>(
        organizationId,
        sessionId ? `/${sessionId}` : '',
        sessionId ? 'PUT' : 'POST',
        draft
      )
    );
    if (result) {
      await this.load(organizationId);
      await this.select(organizationId, result.id);
    }
    return result;
  }

  async status(organizationId: string, sessionId: string, action: 'PUBLISH' | 'CLOSE') {
    const result = await this.operation(() =>
      this.request<TrainingSessions[number]>(organizationId, `/${sessionId}/status`, 'POST', { action })
    );
    if (result) {
      await this.load(organizationId);
      await this.select(organizationId, sessionId);
    }
    return result;
  }

  async issueToken(organizationId: string, sessionId: string, issue: boolean) {
    this.token = null;
    const result = await this.operation(() =>
      this.request<TrainingSessionToken>(organizationId, `/${sessionId}/token`, 'POST', { issue })
    );
    if (result) this.token = result;
    return result;
  }

  async correct(organizationId: string, sessionId: string, correction: TrainingSessionCorrection) {
    const result = await this.operation(() =>
      this.request(organizationId, `/${sessionId}/correction`, 'POST', correction)
    );
    if (result) await this.select(organizationId, sessionId);
    return result;
  }

  async checkin(organizationId: string, sessionId: string, token: string) {
    const result = await this.operation(() =>
      this.request<TrainingSessionCheckin>(organizationId, `/${sessionId}/checkin`, 'POST', { token })
    );
    if (result) {
      await this.select(organizationId, sessionId, true);
      this.notice = t.get(result.duplicate ? 'training_sessions.already_checked_in' : 'training_sessions.checked_in');
    }
    return result;
  }

  async export(organizationId: string, sessionId: string) {
    await this.operation(async () => {
      const query = new URLSearchParams({ search: this.filter.search ?? '', status: this.filter.status ?? 'ALL' });
      const response = await apiClient.request(
        `${getRequestBaseUrl()}/enterprise/sessions/${sessionId}/export?${query}`,
        { credentials: 'include', headers: { 'cio-org-id': organizationId } }
      );
      if (!response.ok) throw new Error(t.get('training_sessions.errors.failed'));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'session-attendance.csv';
      link.click();
      URL.revokeObjectURL(url);
      return true;
    });
  }
}
