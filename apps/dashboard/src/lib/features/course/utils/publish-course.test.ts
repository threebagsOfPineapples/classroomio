import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publishCourse } from './publish-course';

const { updateCourse, deadlineMissing, courseErrors } = vi.hoisted(() => ({
  updateCourse: vi.fn(),
  deadlineMissing: vi.fn(),
  courseErrors: {} as Record<string, string>
}));

vi.mock('$features/course/api', () => ({ courseApi: { update: updateCourse, errors: courseErrors } }));
vi.mock('./compliance-deadline', () => ({ isCourseMissingComplianceDeadline: deadlineMissing }));

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(courseErrors)) delete courseErrors[key];
  deadlineMissing.mockReturnValue(false);
  updateCourse.mockResolvedValue({ id: 'course-one', isPublished: true });
});

describe('internal course publishing', () => {
  it('publishes a historical paid course without editing pricing or enrollment', async () => {
    const course = {
      id: 'course-one',
      type: 'SELF_PACED' as const,
      certificate: null,
      cost: '100',
      metadata: { allowSelfEnrollment: false, paymentLink: '' }
    };
    const result = await publishCourse(course);

    expect(result).toEqual({ ok: true });
    expect(updateCourse).toHaveBeenCalledWith('course-one', { isPublished: true }, { showSuccessToast: true });
    expect(course.metadata.allowSelfEnrollment).toBe(false);
    expect(course.cost).toBe('100');
  });

  it('keeps the compliance deadline gate', async () => {
    deadlineMissing.mockReturnValue(true);
    const result = await publishCourse({ id: 'course-one', type: 'COMPLIANCE', certificate: null });

    expect(result).toEqual({ ok: false, reason: 'missing_deadline' });
    expect(updateCourse).not.toHaveBeenCalled();
  });

  it('reports a rejected save', async () => {
    updateCourse.mockResolvedValue(null);
    const result = await publishCourse({ id: 'course-one', type: 'SELF_PACED', certificate: null });

    expect(result).toEqual({ ok: false, reason: 'failed' });
  });

  it('keeps server deadline errors distinct from other failures', async () => {
    updateCourse.mockResolvedValue(null);
    courseErrors['certificate.deadline'] = 'required';
    const result = await publishCourse({ id: 'course-one', type: 'COMPLIANCE', certificate: null });

    expect(result).toEqual({ ok: false, reason: 'missing_deadline' });
  });
});
