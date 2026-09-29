import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import get from 'lodash/get';
import { createRequire } from 'node:module';
import { get as getStore } from 'svelte/store';
import english from '../translations/en.json';
import chinese from '../translations/zh.json';
import { config, ensureTranslations, locale } from './translations';

const require = createRequire(import.meta.url);
const parserRequire = createRequire(require.resolve('@sveltekit-i18n/parser-icu'));
const { IntlMessageFormat } = parserRequire('intl-messageformat');

function flattenMessages(messages: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(messages).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === 'string'
        ? [[path, value]]
        : Object.entries(flattenMessages(value as Record<string, unknown>, path));
    })
  );
}

function argumentsIn(message: string) {
  const names = new Set<string>();
  function visit(
    nodes: Array<{ type: number; value?: string; children?: unknown; options?: Record<string, { value: unknown }> }>
  ) {
    for (const node of nodes) {
      if (node.type !== 0 && node.type !== 7 && node.value) names.add(node.value);
      if (node.children) visit(node.children as typeof nodes);
      for (const option of Object.values(node.options ?? {})) visit(option.value as typeof nodes);
    }
  }
  visit(new IntlMessageFormat(message, 'zh-CN').getAst());
  return [...names].sort();
}

describe('Chinese translations', () => {
  it('resolves literal interface and notification keys across the dashboard', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    function checkDirectory(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          checkDirectory(path);
          continue;
        }

        if (!/\.(svelte|ts)$/.test(entry.name) || entry.name.includes('.test.')) continue;

        const source = readFileSync(path, 'utf8');
        const pattern = /(?:\$t\(|\bt\.get\(|snackbar\.(?:success|error|info)\()['"]([^'"]+)['"]\s*[,)]/g;
        for (const match of source.matchAll(pattern)) {
          expect(get(chinese, match[1]), `${path}: ${match[1]}`).toBeDefined();
        }
      }
    }
    checkDirectory(root);
  });
  it('covers shared editor menus, tooltips and prompts', () => {
    const root = fileURLToPath(new URL('../../../../../../packages/ui/src/custom/editor/', import.meta.url));
    function checkDirectory(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          checkDirectory(path);
          continue;
        }

        if (!/\.(svelte|ts)$/.test(entry.name)) continue;

        const source = readFileSync(path, 'utf8');
        const pattern = /(?:translate\(|tooltip:\s*|tooltip=|label:\s*)['"]([^'"]+)['"]/g;
        for (const match of source.matchAll(pattern)) {
          const key = match[1]
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
          expect(get(chinese.editor_copy, key), `${entry.name}: ${match[1]}`).toBeDefined();
        }
      }
    }
    checkDirectory(root);
  });
  it('covers every source message with valid ICU syntax and the same argument names', () => {
    const source = flattenMessages(english);
    const translated = flattenMessages(chinese);
    for (const [key, message] of Object.entries(source)) {
      expect(translated[key], key).toBeDefined();
      expect(translated[key].trim().length, key).toBeGreaterThan(0);
      expect(argumentsIn(translated[key]), key).toEqual(argumentsIn(message));
    }
  });

  it('supports an explicit language choice and defaults invalid choices to Chinese', async () => {
    await ensureTranslations('en');
    expect(getStore(locale)).toBe('en');
    await ensureTranslations('invalid');
    expect(getStore(locale)).toBe('zh');
  });
  it('resolves literal translation keys used by the training workflow pages', async () => {
    const messages = await config.loaders.find((item) => item.locale === 'zh')!.loader();
    for (const route of ['plans', 'assessment', 'matrix']) {
      const file = new URL(`../../../routes/(app)/admin/${route}/+page.svelte`, import.meta.url);
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\$t\('([^']+)'/g)) {
        expect(get(messages, match[1]), `${route}: ${match[1]}`).toBeDefined();
      }
    }
  });
  it('loads Chinese course actions without English fallback', async () => {
    const loader = config.loaders.find((item) => item.locale === 'zh');
    expect(loader).toBeDefined();

    const messages = await loader!.loader();
    expect(messages.enterprise.assessment.title).toBe('培训考核');
    expect(messages.course.navItem.lessons.heading_v2).toBe('课程内容');
    expect(messages.course.navItem.lessons.exercises.all_exercises.view_mode.attempt_counter).toBe(
      '第 {current} 次尝试，共 {total} 次'
    );
    expect(messages.certificates.empty_title).toBe('暂无证书');
    expect(messages.settings.profile.personal_information.full_name).toBe('姓名');
    expect(messages.settings.notifications.personal.heading).toBe('个人通知偏好');
    expect(messages.settings.auth.general.heading).toBe('登录与注册设置');
    expect(messages.login.show_password).toBe('显示密码');
    expect(messages.login.invalid_credentials).toBe('邮箱或密码错误，请重新输入。');
    expect(messages.aiTutor.page.org.title).toBe('智能辅导设置');
    expect(messages.course.navItem.lessons.add_lesson.start_reorder).toBe('调整顺序');
    expect(messages.course.navItem.lessons.content_menu.unlock_all).toBe('解锁全部内容');
    expect(messages.course.navItem.lessons.content_menu.disable_grouping).toBe('取消章节分组');
  });
});
