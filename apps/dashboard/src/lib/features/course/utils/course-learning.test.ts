import { describe, expect, it } from 'vitest';
import type { UserEnrolledCourses } from '../types';
import { filterLearningCourses, getCourseLearningAction, getCourseLearningState } from './course-learning';
import { getStudentCourseProgressPercent } from './compliance-utils';

const notStartedCourse = {
  id: 'onboarding',
  title: '公司入职培训',
  type: 'SELF_PACED',
  lessonCount: 3,
  progressRate: 0,
  exerciseCount: 0,
  exercisesCompleted: 0,
  hasEffectiveLearning: false
} as UserEnrolledCourses[number];

describe('课程学习状态与继续入口', () => {
  it('保存有效视频或阅读时间后，即使未完成任何课时也显示学习中', () => {
    const partialCourse = { ...notStartedCourse, hasEffectiveLearning: true };

    expect(getCourseLearningState(partialCourse)).toBe('in_progress');
    expect(getCourseLearningAction(partialCourse).key).toBe('enterprise.ui_v2.continue_course');
    expect(getStudentCourseProgressPercent(partialCourse)).toBe(0);
  });

  it('无有效学习仍为未开始，已有课时或作业完成语义保持兼容', () => {
    expect(getCourseLearningState(notStartedCourse)).toBe('not_started');
    expect(getCourseLearningAction(notStartedCourse).key).toBe('enterprise.ui_v2.start_course');
    expect(getCourseLearningState({ ...notStartedCourse, progressRate: 1 })).toBe('in_progress');
    expect(getCourseLearningState({ ...notStartedCourse, exerciseCount: 1, exercisesCompleted: 1 })).toBe(
      'in_progress'
    );
  });

  it('课程完成优先于有效学习标识，合规课保留考核入口', () => {
    const completedCourse = { ...notStartedCourse, progressRate: 3, hasEffectiveLearning: true };
    const complianceCourse = {
      ...completedCourse,
      type: 'COMPLIANCE',
      complianceStatus: 'in_progress'
    } as UserEnrolledCourses[number];

    expect(getCourseLearningState(completedCourse)).toBe('completed');
    expect(getCourseLearningAction(completedCourse).key).toBe('enterprise.ui_v2.review_course');
    expect(getCourseLearningState(complianceCourse)).toBe('in_progress');
    expect(getCourseLearningAction(complianceCourse).key).toBe('enterprise.ui_v2.view_assessment');
  });

  it('学习中筛选与排序包含未完成课时的课程', () => {
    const partialCourse = { ...notStartedCourse, id: 'partial', hasEffectiveLearning: true };
    const enrolledCourses = [notStartedCourse, partialCourse];

    expect(filterLearningCourses(enrolledCourses, 'in_progress')).toEqual([partialCourse]);
    expect(filterLearningCourses(enrolledCourses, 'all').map((course) => course.id)).toEqual(['partial', 'onboarding']);
  });
});
