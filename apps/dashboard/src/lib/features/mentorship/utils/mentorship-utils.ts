import type { MentorshipBindingDraft, MentorshipChoice, MentorshipOptions } from './types';

export function createMentorshipBindingDraft(now = Date.now()): MentorshipBindingDraft {
  const startsAt = localDateTime(new Date(now).toISOString());
  const endsAt = localDateTime(new Date(now + 90 * 86400000).toISOString());
  return { mentorMemberId: '', planId: '', startsAt, endsAt, search: '', learnerMemberIds: [] };
}

export function localDateTime(value: string) {
  const date = new Date(value);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
}

export function isoDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString();
}

export function memberChoices(members: MentorshipOptions['members']): MentorshipChoice[] {
  return members.map((member) => ({
    value: String(member.id),
    label: [member.fullname ?? member.email ?? String(member.id), member.employeeNo].filter(Boolean).join(' · ')
  }));
}

export function formatMentorshipDate(value: string) {
  return new Date(value).toLocaleString();
}
