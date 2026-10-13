import type { SessionEditorForm, TrainingSessionDetail, TrainingSessionDraft } from './types';

export function localSessionDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function newSessionForm(): SessionEditorForm {
  const start = Date.now() + 60 * 60 * 1000;
  return {
    title: '',
    instructor: '',
    location: '',
    courseId: '',
    planId: '',
    startAt: localSessionDate(new Date(start).toISOString()),
    endAt: localSessionDate(new Date(start + 60 * 60 * 1000).toISOString()),
    checkinOpensAt: localSessionDate(new Date(start - 30 * 60 * 1000).toISOString()),
    checkinClosesAt: localSessionDate(new Date(start + 30 * 60 * 1000).toISOString())
  };
}

export function sessionEditorForm(detail: TrainingSessionDetail): SessionEditorForm {
  const session = detail.session;
  return {
    title: session.title,
    instructor: session.instructor,
    location: session.location,
    courseId: session.courseId ?? '',
    planId: session.planId ?? '',
    startAt: localSessionDate(session.startAt),
    endAt: localSessionDate(session.endAt),
    checkinOpensAt: localSessionDate(session.checkinOpensAt),
    checkinClosesAt: localSessionDate(session.checkinClosesAt)
  };
}

export function sessionDraft(form: SessionEditorForm, memberIds: number[]): TrainingSessionDraft | null {
  const values = [form.startAt, form.endAt, form.checkinOpensAt, form.checkinClosesAt].map((value) => new Date(value));
  if (values.some((date) => !Number.isFinite(date.getTime()))) return null;

  const [startAt, endAt, checkinOpensAt, checkinClosesAt] = values.map((date) => date.toISOString());
  return {
    ...form,
    courseId: form.courseId || null,
    planId: form.planId || null,
    startAt,
    endAt,
    checkinOpensAt,
    checkinClosesAt,
    memberIds
  };
}
