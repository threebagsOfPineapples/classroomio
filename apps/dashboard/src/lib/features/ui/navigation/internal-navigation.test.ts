import { describe, expect, it, vi } from 'vitest';

vi.mock('@cio/ui/custom/moving-icons', () => ({
  CertificateIcon: null,
  ExerciseIcon: null,
  ExploreIcon: null,
  GoalIcon: null,
  HomeIcon: null,
  SettingsIcon: null,
  ChartColumnIcon: null,
  AttachmentIcon: null,
  CourseIcon: null,
  DashboardIcon: null,
  PeopleIcon: null,
  TagIcon: null
}));

import { getLmsNavigationItems } from './lms-navigation';
import { baseNavConfig } from './org-navigation';

describe('internal training navigation', () => {
  it('keeps the five employee workflows in order', () => {
    const items = getLmsNavigationItems(null, (key) => key, '/lms').filter((item) => !item.items);

    expect(items.map((item) => item.url)).toEqual([
      '/lms',
      '/lms/training',
      '/lms/explore',
      '/lms/exercises',
      '/lms/training/archive'
    ]);
  });

  it('selects archive separately from assigned training', () => {
    const items = getLmsNavigationItems(null, (key) => key, '/lms/training/archive');
    const activeItems = items.filter((item) => item.isActive);

    expect(activeItems.map((item) => item.url)).toEqual(['/lms/training/archive']);
  });

  it('omits recruitment and AI entries from management navigation', () => {
    const excludedPaths = ['', '/widgets', '/landingpage', '/community', '/automation/mcp'];

    expect(baseNavConfig.some((item) => excludedPaths.includes(item.path))).toBe(false);
  });
});
