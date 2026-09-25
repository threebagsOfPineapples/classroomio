import { pendingInvitesApi } from '$features/invite/api/pending-invites.svelte';
import { toInviteNotifications } from '$features/invite/utils/invite-notification-utils';
import { enterpriseApi } from '$features/enterprise/api/enterprise.svelte';
import { toTrainingNotifications } from '$features/enterprise/utils/training-notifications';
import type { MyTrainingAssignments } from '$features/enterprise/utils/types';
import { SvelteSet } from 'svelte/reactivity';
import { sortNewestFirst } from '../utils/notification-utils';

/**
 * Single seam the bell badge and the panel list both read, so a new notification kind
 * cannot leave the badge under-counting.
 */
class NotificationsApi {
  private trainingContext = '';
  private trainingOrganizationId = '';
  private trainingProfileId = '';
  private readTrainingIds = new SvelteSet<string>();
  private trainingAssignments = $state<MyTrainingAssignments>([]);
  private trainingLoading = $state(false);
  private trainingHasLoaded = $state(false);

  items = $derived(
    sortNewestFirst([
      ...toInviteNotifications(pendingInvitesApi.invites),
      ...toTrainingNotifications(this.trainingAssignments, this.readTrainingIds)
    ])
  );
  unreadCount = $derived(this.items.filter((item) => item.unread).length);

  get isLoading() {
    return pendingInvitesApi.isLoading || this.trainingLoading;
  }

  get hasLoaded() {
    return pendingInvitesApi.hasLoaded && (!this.trainingContext || this.trainingHasLoaded);
  }

  fetchOnce() {
    return pendingInvitesApi.fetchOnce();
  }

  async loadTraining(organizationId: string, profileId: string, force = false) {
    const context = `${organizationId}:${profileId}`;
    const contextChanged = this.trainingContext !== context;
    if (!contextChanged && !force) return;

    this.trainingContext = context;
    this.trainingOrganizationId = organizationId;
    this.trainingProfileId = profileId;
    if (contextChanged) {
      this.trainingAssignments = [];
      this.trainingHasLoaded = false;
      this.readTrainingIds.clear();
    }
    this.trainingLoading = true;

    if (contextChanged) {
      try {
        const savedReadIds = window.localStorage.getItem(`classroomio_training_notifications_read:${context}`);
        const parsedReadIds: unknown = savedReadIds ? JSON.parse(savedReadIds) : [];
        if (Array.isArray(parsedReadIds)) {
          for (const id of parsedReadIds) {
            if (typeof id === 'string') this.readTrainingIds.add(id);
          }
        }
      } catch {
        this.readTrainingIds.clear();
      }
    }

    try {
      const assignments = await enterpriseApi.request<MyTrainingAssignments>(organizationId, '/my-training');
      if (this.trainingContext === context) this.trainingAssignments = assignments;
    } catch {
      if (this.trainingContext === context) this.trainingAssignments = [];
    } finally {
      if (this.trainingContext === context) {
        this.trainingLoading = false;
        this.trainingHasLoaded = true;
      }
    }
  }

  markTrainingRead(enrollmentId: string) {
    if (!this.trainingContext || !this.trainingAssignments.some((item) => item.enrollmentId === enrollmentId)) return;

    this.readTrainingIds.add(enrollmentId);
    try {
      window.localStorage.setItem(
        `classroomio_training_notifications_read:${this.trainingContext}`,
        JSON.stringify([...this.readTrainingIds])
      );
    } catch {
      return;
    }
  }

  async refresh() {
    const inviteRefresh = pendingInvitesApi.fetchPendingInvites();
    const trainingRefresh = this.trainingContext
      ? this.loadTraining(this.trainingOrganizationId, this.trainingProfileId, true)
      : Promise.resolve();
    await Promise.all([inviteRefresh, trainingRefresh]);
  }
}

export const notificationsApi = new NotificationsApi();
