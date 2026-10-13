import { AppError, ErrorCodes } from '@api/utils/errors';

export function trainingSessionError(key: string, status = 400): never {
  throw new AppError(`training_sessions.errors.${key}`, ErrorCodes.VALIDATION_ERROR, status);
}

export function requireSessionCheckinWindow(
  session: { status: string; checkinOpensAt: string; checkinClosesAt: string },
  now: number
) {
  if (session.status !== 'PUBLISHED') trainingSessionError('closed', 409);
  if (now < Date.parse(session.checkinOpensAt)) trainingSessionError('not_open', 409);
  if (now >= Date.parse(session.checkinClosesAt)) trainingSessionError('expired', 409);
}

export function sessionAttendanceDisplayStatus(
  session: { status: string; startAt: string; endAt: string },
  attendance: { status: string; checkedInAt: string | null },
  now: number
) {
  if (attendance.status === 'PRESENT')
    return attendance.checkedInAt && Date.parse(attendance.checkedInAt) > Date.parse(session.startAt)
      ? 'LATE'
      : 'PRESENT';
  if (attendance.status === 'LEAVE') return 'LEAVE';
  return session.status === 'CLOSED' || now >= Date.parse(session.endAt) ? 'ABSENT' : 'PENDING';
}
