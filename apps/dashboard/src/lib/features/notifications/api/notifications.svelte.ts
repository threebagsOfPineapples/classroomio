import { pendingInvitesApi } from '$features/invite/api/pending-invites.svelte';
import { toInviteNotifications } from '$features/invite/utils/invite-notification-utils';
import { enterpriseApi } from '$features/enterprise/api/enterprise.svelte';
import {
  toCertificateNotifications,
  toCourseDeadlineNotifications,
  toExamNotifications,
  toTrainingNotifications
} from '$features/enterprise/utils/training-notifications';
import type { MyTrainingAssignments, TrainingArchiveSummary } from '$features/enterprise/utils/types';
import type { UserEnrolledCourses } from '$features/course/types';
import { classroomio } from '$lib/utils/services/api';
import { SvelteSet } from 'svelte/reactivity';
import { sortNewestFirst } from '../utils/notification-utils';
import type { NotificationItem } from '../utils/types';

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
  private trainingArchiveRecords = $state<TrainingArchiveSummary['records']>([]);
  private enrolledCourses = $state<UserEnrolledCourses>([]);
  private trainingLoading = $state(false);
  private trainingHasLoaded = $state(false);

  items = $derived(
    sortNewestFirst([
      ...toInviteNotifications(pendingInvitesApi.invites),
      ...toTrainingNotifications(this.trainingAssignments, this.readTrainingIds),
      ...toCertificateNotifications(this.trainingArchiveRecords, this.readTrainingIds),
      ...toCourseDeadlineNotifications(this.trainingAssignments, this.enrolledCourses, this.readTrainingIds),
      ...toExamNotifications(this.trainingAssignments, this.readTrainingIds)
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
      this.trainingArchiveRecords = [];
      this.enrolledCourses = [];
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

    const [assignmentResult, archiveResult, courseResult] = await Promise.allSettled([
      enterpriseApi.request<MyTrainingAssignments>(organizationId, '/my-training'),
      enterpriseApi.request<TrainingArchiveSummary>(organizationId, '/archive/summary'),
      classroomio.organization.courses.enrolled.$get({}).then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error('Failed to load enrolled courses');

        return result.data;
      })
    ]);
    if (this.trainingContext === context) {
      this.trainingAssignments = assignmentResult.status === 'fulfilled' ? assignmentResult.value : [];
      this.trainingArchiveRecords = archiveResult.status === 'fulfilled' ? archiveResult.value.records : [];
      this.enrolledCourses = courseResult.status === 'fulfilled' ? courseResult.value : [];
      this.trainingLoading = false;
      this.trainingHasLoaded = true;
    }
  }

  markTrainingRead(notification: NotificationItem) {
    if (
      !this.trainingContext ||
      !(
        this.trainingAssignments.some((item) => item.enrollmentId === notification.sourceId) ||
        this.trainingArchiveRecords.some((item) => item.enrollmentId === notification.sourceId)
      )
    )
      return;

    this.readTrainingIds.add(notification.id);
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
