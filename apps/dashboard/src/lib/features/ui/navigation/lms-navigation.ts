import {
  CertificateIcon,
  ExerciseIcon,
  ExploreIcon,
  GoalIcon,
  HomeIcon,
  SettingsIcon
} from '@cio/ui/custom/moving-icons';

import type { AccountOrg } from '$features/app/types';
import type { Component } from 'svelte';
import { isActive } from '$lib/utils/functions/app';

export interface NavItem {
  title: string;
  url: string;
  path: string;
  icon?: Component;
  isActive?: boolean;
  isExpanded?: boolean;
  show?: () => boolean;
  items?: NavItem[];
  useHashUrl?: boolean;
  nestedRoutes?: NestedRouteConfig[];
  supportsDynamicSegment?: boolean;
}

export interface NestedRouteConfig {
  path: string; // Relative to parent (e.g., 'ask', 'integrations')
  titleKey: string; // Translation key or plain text
}

export interface NavItemConfig {
  titleKey: string;
  path: string;
  icon?: Component;
  show?: (currentOrg: AccountOrg | null) => boolean;
  matchPattern?: string;
  items?: NavItemConfig[];
  useHashUrl?: boolean;
  nestedRoutes?: NestedRouteConfig[];
  supportsDynamicSegment?: boolean;
}

// Base navigation configuration structure
export const baseNavConfig: NavItemConfig[] = [
  {
    titleKey: 'lms_navigation.home',
    path: '',
    icon: HomeIcon,
    matchPattern: '^/lms/?$'
  },
  {
    titleKey: 'enterprise.my_training.title',
    path: '/training',
    icon: GoalIcon,
    matchPattern: '^/lms/training(?!/archive)(/.*)?$'
  },
  {
    titleKey: 'lms_navigation.explore',
    path: '/explore',
    icon: ExploreIcon,
    matchPattern: '^/lms/explore(/.*)?$'
  },
  {
    titleKey: 'lms_navigation.exercise',
    path: '/exercises',
    icon: ExerciseIcon,
    matchPattern: '^/lms/exercises(/.*)?$'
  },
  {
    titleKey: 'enterprise.assessment.archive',
    path: '/training/archive',
    icon: CertificateIcon,
    matchPattern: '^/lms/(training/archive|certificates)(/.*)?$'
  },
  {
    titleKey: 'lms_navigation.settings',
    path: '/settings',
    icon: SettingsIcon,
    useHashUrl: true,
    matchPattern: '^/lms/settings(/.*)?$',
    items: [
      {
        titleKey: 'settings.tabs.profile_tab',
        path: '/settings'
      },
      {
        titleKey: 'settings.tabs.notifications_tab',
        path: '/settings/notifications'
      },
      {
        titleKey: 'settings.tabs.integrations_tab',
        path: '/settings/integrations'
      }
    ],
    nestedRoutes: [
      {
        path: 'notifications',
        titleKey: 'settings.tabs.notifications_tab'
      },
      {
        path: 'integrations',
        titleKey: 'settings.tabs.integrations_tab'
      }
    ]
  }
];

/**
 * Get LMS navigation items based on organization context
 */
export function getLmsNavigationItems(
  currentOrg: AccountOrg | null,
  t: (key: string) => string,
  pagePathname: string
): NavItem[] {
  const items: NavItem[] = [];

  for (const config of baseNavConfig) {
    // Skip items that should be hidden based on customization
    if (config.show && !config.show(currentOrg)) {
      continue;
    }

    const url = config.path === '' ? '/lms' : `/lms${config.path}`;
    const fullPath = config.path === '' ? '/lms' : `/lms${config.path}`;

    const item: NavItem = {
      title: t(config.titleKey),
      url: config.useHashUrl ? '#' : url,
      path: config.path,
      icon: config.icon,
      isActive: isActive(pagePathname, fullPath, config.matchPattern),
      isExpanded: config.items ? isActive(pagePathname, fullPath, config.matchPattern) : undefined,
      useHashUrl: config.useHashUrl,
      nestedRoutes: config.nestedRoutes,
      supportsDynamicSegment: config.supportsDynamicSegment,
      show: config.show ? () => config.show!(currentOrg) : undefined
    };

    // Handle nested items (like settings sub-items)
    if (config.items) {
      item.items = config.items.map((subConfig) => ({
        title: t(subConfig.titleKey),
        url: `/lms${subConfig.path}`,
        path: subConfig.path
      }));
    }

    items.push(item);
  }

  return items;
}
